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
    "UPDATE events SET description='bad'",
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

test("add status SQL distinguishes proposed creation, published creation, skips, failed matches, and missing reports", async () => {
  const { submitAddJobs } = await import("../../../../ingestion/jobs/store");
  const db = testDatabase();
  const batch = submitAddJobs(db.client, {
    inputs: ["x".repeat(70000), ...Array(9).fill("Event research note")],
  });
  const jobs = db.client
    .prepare("SELECT id FROM ingestion_jobs ORDER BY position")
    .pluck()
    .all() as string[];
  const { fixtureDependencies, runFixtureResearch } =
    await import("@/test/ingestion");
  const { DEFAULT_RESEARCH_LIMITS } =
    await import("../../../../ingestion/runtime/budget");
  const deps = fixtureDependencies();
  const declined = await runFixtureResearch(
    { mode: "add", input: "Example Fest", actor: "test", dryRun: false },
    {
      client: db.client,
      config: {
        apiKey: "fixture",
        model: "fixture",
        limits: DEFAULT_RESEARCH_LIMITS,
      },
      ...deps,
      generateRoles: {
        editor: async (role, prompt, context) => {
          const review = (await deps.generateRole(role, prompt, context)) as {
            decisions: import("@/ingestion/review").ReviewDecision[];
          };
          Object.assign(
            review.decisions.find(({ path }) => path === "event.target")!,
            {
              decision: "reject",
              note: "Creation was declined because identity is unresolved.",
            },
          );
          return review;
        },
      },
    },
  );
  expect(declined.outcome).toBe("failed");
  expect(declined.errors).toContainEqual(
    expect.objectContaining({ code: "editor_rejected" }),
  );
  const reports = [
    {
      outcome: "published",
      operations: [{ kind: "createEvent" }],
      receipts: [{ changed: true }],
      eventId: "temporary",
    },
    {
      outcome: "published",
      operations: [{ kind: "createEvent" }, { kind: "publishEvent" }],
      receipts: [{ changed: true }, { changed: true }],
      eventId: "created",
    },
    {
      outcome: "skipped",
      modelResponse: {
        object: {
          result: {
            decision: "duplicate",
            reason: "Inspected organizer confirms this saved Event.",
          },
        },
      },
      eventId: "existing",
    },
    declined,
    {
      outcome: "failed",
      modelResponse: {
        object: {
          result: {
            decision: "duplicate",
            reason: "Candidate requires validation",
          },
        },
      },
      eventId: "candidate",
    },
    null,
  ];
  reports.forEach((report, index) =>
    db.client
      .prepare(
        "INSERT INTO ingestion_runs(id,job_id,event_id,mode,status,started_at,input_json,report_json) VALUES(?,?,?,'add',?,'2026-11-04',?,?)",
      )
      .run(
        `add-${index}`,
        jobs[index],
        index === 1 ? "created" : null,
        index === 3 || index === 4 ? "failed" : "completed",
        JSON.stringify({ dryRun: index === 0 }),
        report
          ? JSON.stringify({
              schemaVersion: 7,
              operations: [],
              receipts: [],
              ...report,
            })
          : null,
      ),
  );
  db.client
    .prepare(
      "INSERT INTO ingestion_runs(id,job_id,mode,status,started_at,input_json,report_json) VALUES('bad-report',?,'add','failed','2026-11-04','{\"dryRun\":false}','{')",
    )
    .run(jobs[6]);
  db.client
    .prepare(
      "INSERT INTO ingestion_runs(id,job_id,mode,status,started_at,input_json,report_json) VALUES('bad-input',?,'add','failed','2026-11-04','{',?)",
    )
    .run(jobs[7], JSON.stringify({ schemaVersion: 7, outcome: "unchanged" }));
  for (const [index, schemaVersion] of [999, 7].entries()) {
    db.client
      .prepare(
        "INSERT INTO ingestion_runs(id,job_id,mode,status,started_at,input_json,report_json) VALUES(?,?,'add','failed','2026-11-04','{}',?)",
      )
      .run(
        `unfamiliar-report-${index}`,
        jobs[8 + index],
        JSON.stringify({
          schemaVersion,
          errors: ["example"],
          operations: ["example", { kind: "createEvent" }],
          receipts: ["example", "example"],
        }),
      );
  }
  const sql = readFileSync(
    new URL(
      "../../skills/catalog-sql/references/inspect-add-batch.sql",
      import.meta.url,
    ),
    "utf8",
  ).trim();
  const result = queryCatalog(db.path, { sql, parameters: [batch.batchId] });
  expect(result).toMatchObject({ ok: true, rowCount: 10, truncated: false });
  if (!result.ok) {
    throw new Error("Expected valid query");
  }
  const rows = result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, i) => [column, row[i]])),
  );
  expect(rows.map((row) => row.position)).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  expect(rows[0]).toMatchObject({
    preview: 1,
    proposedCreation: 1,
    changedCreation: 1,
    savedEventId: null,
  });
  expect(rows[1]).toMatchObject({
    preview: 0,
    outcome: "published",
    changedCreation: 1,
    savedEventId: "created",
  });
  expect(rows[2]).toMatchObject({
    outcome: "skipped",
    identityDecision: "duplicate",
    reportedEventId: "existing",
  });
  expect(rows[3]).toMatchObject({
    outcome: "failed",
    editorRejected: 1,
    editorItemDecision: "approve",
    editorItemReason: "Explicit fixture review",
    editorTargetDecision: "reject",
    editorTargetReason: expect.stringContaining("Creation was declined"),
  });
  expect(rows[4]).toMatchObject({
    runStatus: "failed",
    outcome: "failed",
    reportedEventId: "candidate",
    savedEventId: null,
    changedCreation: 0,
  });
  expect(rows[5]).toMatchObject({
    reportPresent: 0,
    outcome: null,
    proposedCreation: 0,
    changedCreation: 0,
  });
  expect(rows[6]).toMatchObject({
    inputValid: 1,
    reportPresent: 1,
    reportValid: 0,
    preview: 0,
    outcome: null,
    proposedCreation: 0,
    changedCreation: 0,
  });
  expect(rows[7]).toMatchObject({
    inputValid: 0,
    reportValid: 1,
    preview: null,
    outcome: "unchanged",
  });
  for (const [index, schemaVersion] of [999, 7].entries()) {
    expect(rows[8 + index]).toMatchObject({
      reportValid: 1,
      schemaVersion,
      outcome: null,
      editorRejected: 0,
      proposedCreation: 1,
      changedCreation: 0,
    });
  }
});
