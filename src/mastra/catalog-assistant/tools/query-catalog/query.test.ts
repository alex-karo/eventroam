import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { queryCatalog } from "./query";
import { SQL_LIMITS } from "./contracts";
import {
  INSPECT_RUN_SQL,
  INSPECT_RUN_STATE_SQL,
  RUN_EVIDENCE_SQL,
} from "@/test/catalog-sql";

test("SQLite accepts joins, CTEs, comments, parameters, and metadata reads", () => {
  const db = testDatabase();
  const fixtures = testFixtures();
  const event = fixtures.event();
  fixtures.edition(event);
  expect(
    queryCatalog(db.path, {
      sql: "WITH e AS (SELECT id FROM events) SELECT e.id, d.edition_key FROM e JOIN editions d ON d.event_id=e.id WHERE e.id=? -- comment",
      parameters: [event.id],
    }),
  ).toMatchObject({
    ok: true,
    rowCount: 1,
    rows: [[event.id, expect.any(String)]],
  });
  expect(
    queryCatalog(db.path, {
      sql: "SELECT name FROM pragma_table_info('events')",
    }),
  ).toMatchObject({ ok: true });
});

test("SQLite rejects mutations, scripts, connection changes and external access without changing files", () => {
  const db = testDatabase();
  testFixtures().event();
  const original = readFileSync(db.path);
  const outside = join(dirname(db.path), "outside.sqlite");
  const attempts = [
    "DELETE FROM events",
    "UPDATE events SET summary='bad'",
    "INSERT INTO events(id) VALUES ('bad')",
    "DROP TABLE events",
    "VACUUM",
    "BEGIN",
    "PRAGMA query_only=OFF",
    `ATTACH '${outside}' AS other`,
    `VACUUM INTO '${outside}'`,
    "SELECT load_extension('bad')",
    "SELECT readfile('/etc/passwd')",
    "SELECT writefile('/tmp/bad','bad')",
    "SELECT * FROM pragma_query_only(0)",
    "SELECT * FROM pragma_journal_mode('DELETE')",
    "SELECT 1; DELETE FROM events",
    "SELECT 1); DELETE FROM events; --",
    "SELECT 1) UNION SELECT 2; --",
    "SELECT 1\0; DELETE FROM events",
    "SELECT 1 /*",
    "-- empty",
    "SELECT unknown FROM events",
  ];
  for (const sql of attempts) {
    expect(queryCatalog(db.path, { sql }), sql).toMatchObject({ ok: false });
  }
  expect(readFileSync(db.path)).toEqual(original);
  expect(existsSync(outside)).toBe(false);
  expect(
    queryCatalog(db.path, { sql: "SELECT count(*) FROM events" }),
  ).toMatchObject({ ok: true, rows: [[1]] });
});

test("output bounds cover rows, bytes and columns, and preserve SQL values", () => {
  const { path } = testDatabase();
  const run = (sql: string) => queryCatalog(path, { sql });
  expect(run("SELECT NULL, 9223372036854775807, x'00ff', 42")).toMatchObject({
    rows: [
      [null, "9223372036854775807", { encoding: "base64", data: "AP8=" }, 42],
    ],
  });
  expect(
    run(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) SELECT x FROM n",
    ),
  ).toMatchObject({ rowCount: 200, truncated: true });
  for (const sql of [
    "SELECT hex(zeroblob(40000)) AS big",
    'SELECT 1 AS "' + "\u0001".repeat(12000) + '"',
    "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<200) SELECT hex(zeroblob(300)),x FROM n",
  ]) {
    const result = run(sql);
    expect(result).toMatchObject({ ok: true, truncated: true });
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
      SQL_LIMITS.outputBytes,
    );
  }
  expect(
    queryCatalog(path, { sql: "x".repeat(SQL_LIMITS.inputBytes + 1) }),
  ).toMatchObject({ error: "invalid_input" });
});

test("pre-abort does not create a catalog and an error does not poison later connections", () => {
  const { path } = testDatabase();
  const signal = AbortSignal.abort();
  expect(
    queryCatalog(path + "-missing", { sql: "SELECT 1" }, signal),
  ).toMatchObject({ error: "cancelled" });
  expect(existsSync(path + "-missing")).toBe(false);
  expect(queryCatalog(path, { sql: "SELECT nonexistent()" })).toMatchObject({
    error: "query_rejected",
  });
  expect(queryCatalog(path, { sql: "SELECT 1" })).toMatchObject({
    rows: [[1]],
  });
});

test("report SQL examples inspect absent, unfinished, malformed, unfamiliar and bounded evidence", () => {
  const db = testDatabase();
  const insert = db.client.prepare(
    "INSERT INTO ingestion_runs(id,mode,status,started_at,input_json,report_json) VALUES (?,'refresh','failed','2026-10-27',?,?)",
  );
  insert.run("null", JSON.stringify({ dryRun: true }), null);
  insert.run("invalid", "{}", "bad json");
  insert.run(
    "invalid-input",
    "bad input",
    JSON.stringify({ schemaVersion: 7 }),
  );
  insert.run(
    "future",
    "{}",
    JSON.stringify({ schemaVersion: 999, outcome: "invented" }),
  );
  insert.run(
    "valid",
    JSON.stringify({ dryRun: false }),
    JSON.stringify({
      schemaVersion: 7,
      outcome: "unchanged",
      researchStatus: "partial",
      changes: Array.from({ length: 1000 }, (_, i) => ({
        field: String(i),
        newValue: "x".repeat(10000),
      })),
    }),
  );
  const inspect = (id: string) =>
    queryCatalog(db.path, { sql: INSPECT_RUN_SQL, parameters: [id] });
  expect(inspect("missing")).toMatchObject({ rows: [], truncated: false });
  const mapped = (id: string, sql = INSPECT_RUN_SQL) => {
    const result = queryCatalog(db.path, { sql, parameters: [id] });
    if (!result.ok) {
      throw new Error("query failed");
    }
    return Object.fromEntries(
      result.columns.map((name, i) => [name, result.rows[0][i]]),
    );
  };
  expect(mapped("null")).toMatchObject({
    reportPresent: 0,
    dryRun: 1,
    outcome: null,
  });
  for (const id of ["invalid", "invalid-input"]) {
    expect(inspect(id)).toEqual({ ok: false, error: "query_rejected" });
  }
  expect(mapped("invalid", INSPECT_RUN_STATE_SQL)).toMatchObject({
    status: "failed",
    reportPresent: 1,
    reportValid: 0,
    inputValid: 1,
  });
  expect(mapped("invalid-input", INSPECT_RUN_STATE_SQL)).toMatchObject({
    reportPresent: 1,
    reportValid: 1,
    inputValid: 0,
  });
  expect(mapped("future")).toMatchObject({
    schemaVersion: 999,
    outcome: "invented",
  });
  expect(mapped("valid")).toMatchObject({
    dryRun: 0,
    outcome: "unchanged",
    researchStatus: "partial",
  });
  expect(
    queryCatalog(db.path, { sql: RUN_EVIDENCE_SQL, parameters: ["valid"] }),
  ).toMatchObject({ ok: true, truncated: true });
  expect(
    queryCatalog(db.path, { sql: RUN_EVIDENCE_SQL, parameters: ["invalid"] }),
  ).toEqual({ ok: false, error: "query_rejected" });
});
