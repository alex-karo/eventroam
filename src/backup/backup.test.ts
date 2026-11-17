import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { DuckDBConnection, DuckDBStore } from "@mastra/duckdb";
import { LibSQLStore } from "@mastra/libsql";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { applyRetention } from "./retention";
import { checkDatabases } from "./storage";

const day = 86_400_000;
const old = (days: number) => new Date(Date.now() - days * day).toISOString();

function ids(root: string, file: string, table: string, column = "id") {
  const db = new Database(join(root, file), { readonly: true });
  try {
    return db
      .prepare(`SELECT ${column} FROM ${table} ORDER BY ${column}`)
      .pluck()
      .all();
  } finally {
    db.close();
  }
}

test("Mastra and file-age retention preserve recent and durable data", async ({
  onTestFinished,
}) => {
  const root = mkdtempSync(join(tmpdir(), "eventroam-backup-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  await testDatabase().client.backup(join(root, "eventroam.sqlite"));
  for (const name of ["workflows", "chat", "evals"]) {
    const store = new LibSQLStore({
      id: "fixture",
      url: pathToFileURL(join(root, `mastra-${name}.sqlite`)).href,
    });
    await store.init();
    if (name === "evals") {
      await (await store.getStore("datasets"))!.createDataset({
        id: "authored-dataset",
        name: "Keep",
      });
    }
    await store.close();
  }
  const observations = new DuckDBStore({
    path: join(root, "mastra-observability.duckdb"),
    threads: 1,
  });
  await observations.init();
  try {
    for (const days of [2, 8, 91]) {
      await observations.db.execute(
        "INSERT INTO span_events (eventType, timestamp, traceId, spanId) VALUES ('span_started', ?, ?, ?)",
        [old(days), `trace-${days}`, `span-${days}`],
      );
      await observations.db.execute(
        "INSERT INTO log_events (timestamp, logId, level, message, traceId, spanId) VALUES (?, ?, 'info', 'kept independently', ?, ?)",
        [old(days), `log-${days}`, `trace-${days}`, `span-${days}`],
      );
    }
  } finally {
    await observations.close();
  }
  const workflows = new Database(join(root, "mastra-workflows.sqlite"));
  for (const [id, status, days] of [
    ["finished", "success", 91],
    ["recent", "success", 2],
    ["active", "running", 91],
  ] as const) {
    workflows
      .prepare(
        "INSERT INTO mastra_workflow_snapshot(workflow_name,run_id,snapshot,createdAt,updatedAt) VALUES ('test',?,?,?,?)",
      )
      .run(id, JSON.stringify({ status }), old(days), old(days));
  }
  workflows.close();
  const chats = new Database(join(root, "mastra-chat.sqlite"));
  for (const [id, days] of [
    ["old", 91],
    ["recent", 2],
  ] as const) {
    chats
      .prepare(
        "INSERT INTO mastra_threads(id,resourceId,title,createdAt,updatedAt) VALUES (?, 'owner', 'test', ?, ?)",
      )
      .run(id, old(days), old(2));
  }
  for (const days of [2, 91]) {
    chats
      .prepare(
        "INSERT INTO mastra_messages(id,thread_id,content,role,type,createdAt) VALUES (?, ?, '{}', 'user', 'text', ?)",
      )
      .run(`message-${days}`, days === 91 ? "old" : "recent", old(days));
  }
  chats.close();
  const evals = new Database(join(root, "mastra-evals.sqlite"));
  for (const id of ["old", "active", "recent"]) {
    evals
      .prepare(
        `INSERT INTO mastra_experiments
      (id,datasetId,datasetVersion,status,totalItems,succeededCount,failedCount,skippedCount,createdAt,updatedAt,completedAt)
      VALUES (?, 'authored-dataset', 1, ?, 1, 0, 0, 0, ?, ?, ?)`,
      )
      .run(
        id,
        id === "active" ? "running" : "completed",
        old(91),
        old(91),
        id === "active" ? null : old(id === "old" ? 91 : 2),
      );
  }
  evals.close();
  const sourceDirs: Record<string, string> = {};
  for (const [id, days] of [
    ["old", 31],
    ["recent", 2],
  ] as const) {
    const dir = join(
      root,
      "ingestion-sources",
      `2026-01-01T00-00-00.000Z_${id}`,
    );
    sourceDirs[id] = dir;
    mkdirSync(join(dir, "sources"), { recursive: true });
    for (const name of ["s1.md", "s1.evidence.json"]) {
      const file = join(dir, "sources", name);
      writeFileSync(file, "saved page");
      const time = new Date(old(days));
      utimesSync(file, time, time);
    }
  }
  await applyRetention(root);
  expect(
    ids(root, "mastra-workflows.sqlite", "mastra_workflow_snapshot", "run_id"),
  ).toEqual(["recent"]);
  expect(ids(root, "mastra-chat.sqlite", "mastra_threads")).toEqual(["recent"]);
  expect(ids(root, "mastra-chat.sqlite", "mastra_messages")).toEqual([
    "message-2",
  ]);
  expect(ids(root, "mastra-evals.sqlite", "mastra_experiments")).toEqual([
    "active",
    "recent",
  ]);
  expect(ids(root, "mastra-evals.sqlite", "mastra_datasets")).toEqual([
    "authored-dataset",
  ]);
  expect(existsSync(sourceDirs.old)).toBe(false);
  expect(existsSync(join(sourceDirs.recent, "sources/s1.md"))).toBe(true);
  expect(existsSync(join(sourceDirs.recent, "sources/s1.evidence.json"))).toBe(
    true,
  );
  const db = new DuckDBStore({
    path: join(root, "mastra-observability.duckdb"),
    threads: 1,
  });
  try {
    expect(await db.db.query("SELECT traceId FROM span_events")).toEqual([
      { traceId: "trace-2" },
    ]);
    expect(
      await db.db.query("SELECT logId FROM log_events ORDER BY logId"),
    ).toEqual(["log-2", "log-8"].map((logId) => ({ logId })));
  } finally {
    await db.close();
  }
});

test("prepare and verify reject a DuckDB read error after the first chunk", async ({
  onTestFinished,
}) => {
  const root = mkdtempSync(join(tmpdir(), "eventroam-backup-scan-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const name of [
    "eventroam",
    "mastra-workflows",
    "mastra-chat",
    "mastra-evals",
  ]) {
    const db = new Database(join(root, `${name}.sqlite`));
    db.exec("CREATE TABLE data (id INTEGER)");
    db.close();
  }
  const db = new DuckDBConnection({
    path: join(root, "mastra-observability.duckdb"),
    threads: 1,
    memoryLimit: "512MB",
  });
  try {
    await db.execute('CREATE SCHEMA "source""data"');
    await db.execute(
      'CREATE TABLE "source""data"."saved""rows" AS SELECT i FROM range(5000) t(i)',
    );
    await db.execute("CHECKPOINT");
  } finally {
    await db.close();
  }
  const connect = DuckDBConnection.prototype.getConnection;
  let reads = 0;
  const spy = vi
    .spyOn(DuckDBConnection.prototype, "getConnection")
    .mockImplementation(async function (this: DuckDBConnection) {
      const connection = await connect.call(this);
      const stream = connection.stream.bind(connection);
      vi.spyOn(connection, "stream").mockImplementation(async (...args) => {
        const result = await stream(...args);
        const fetch = result.fetchChunk.bind(result);
        let chunks = 0;
        vi.spyOn(result, "fetchChunk").mockImplementation(async () => {
          reads++;
          if (chunks++ > 0) {
            throw new Error("Unreadable DuckDB data block");
          }
          return fetch();
        });
        return result;
      });
      return connection;
    });
  onTestFinished(() => spy.mockRestore());
  for (const checkpoint of [true, false]) {
    await expect(checkDatabases(root, checkpoint)).rejects.toThrow(
      "Unreadable DuckDB data block",
    );
  }
  expect(reads).toBe(4);
});
