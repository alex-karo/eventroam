import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { DEFAULT_RESEARCH_LIMITS } from "../runtime/budget";
import { startIngestionRun, storedRunInput } from "../runs";
import {
  submitJobs,
  nextJob,
  finishJob,
  cancelPendingJobs,
  openJobCatalog,
} from "./store";

function setup(n = 3) {
  const { client } = testDatabase();
  const fixtures = testFixtures();
  return {
    client,
    eventIds: Array.from({ length: n }, () => fixtures.event().id),
  };
}

test("a complete 200 Event batch has fixed settings, common time, distinct IDs and selection order", () => {
  const { client, eventIds } = setup(200);
  const result = submitJobs(client, {
    eventIds,
    scope: "current",
    dryRun: false,
  });
  expect(result).toEqual({ batchId: expect.any(String), acceptedCount: 200 });
  const rows = client
    .prepare("SELECT * FROM ingestion_jobs ORDER BY position")
    .all() as Record<string, unknown>[];
  expect(rows.map((row) => row.event_id)).toEqual(eventIds);
  expect(new Set(rows.map((row) => row.id)).size).toBe(200);
  expect(new Set(rows.map((row) => row.created_at)).size).toBe(1);
  expect(rows[0]).toMatchObject({
    batch_id: result.batchId,
    scope: "current",
    dry_run: 0,
    status: "pending",
  });
  expect(Object.keys(rows[0])).not.toContain("started_at");
  expect(Object.keys(rows[0])).not.toContain("finished_at");
  expect(client.pragma("foreign_key_list(ingestion_jobs)")).toEqual([]);
  expect(client.pragma("foreign_key_check")).toEqual([]);
});

test("invalid selections consume nothing and a failed insert rolls back the complete batch", () => {
  const { client, eventIds } = setup();
  const consume = vi.fn();
  for (const ids of [
    [],
    [eventIds[0], eventIds[0]],
    [eventIds[0], "missing"],
    Array.from({ length: 201 }, (_, i) => String(i)),
  ]) {
    expect(() => submitJobs(client, { eventIds: ids }, consume)).toThrow();
  }
  expect(consume).not.toHaveBeenCalled();
  const prepare = client.prepare.bind(client);
  const spy = vi.spyOn(client, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
    if (sql.startsWith("INSERT INTO ingestion_jobs")) {
      const run = statement.run.bind(statement);
      let n = 0;
      vi.spyOn(statement, "run").mockImplementation((...args: unknown[]) => {
        if (++n === 2) {
          throw new Error("Injected insert failure");
        }
        return run(...args);
      });
    }
    return statement;
  });
  expect(() => submitJobs(client, { eventIds }, consume)).toThrow(
    "job_storage_unavailable",
  );
  spy.mockRestore();
  expect(consume).toHaveBeenCalledTimes(1);
  expect(client.prepare("SELECT count(*) n FROM ingestion_jobs").get()).toEqual(
    { n: 0 },
  );
});

test("cancellation and claiming in either order preserve running and terminal jobs", () => {
  const { client, eventIds } = setup(4);
  const { batchId } = submitJobs(client, { eventIds });
  const first = nextJob(client)!;
  expect(first.event_id).toBe(eventIds[0]);
  // A saved running job stays running when the next execution selects it.
  expect(nextJob(client)).toEqual(first);
  expect(cancelPendingJobs(client, batchId)).toMatchObject({
    cancelledCount: 3,
  });
  expect(cancelPendingJobs(client, batchId)).toMatchObject({
    cancelledCount: 0,
  });
  expect(nextJob(client)).toEqual(first);
  finishJob(client, first.id);
  expect(nextJob(client)).toBeUndefined();
  expect(() =>
    cancelPendingJobs(client, "00000000-0000-4000-8000-000000000001"),
  ).toThrow("batch_not_found");
  const later = submitJobs(client, { eventIds: [eventIds[0]] });
  cancelPendingJobs(client, later.batchId);
  expect(nextJob(client)).toBeUndefined();
});

test("attempt insertion checks job state and all fixed inputs and permits several distinct attempts", () => {
  const { client, eventIds } = setup(1);
  submitJobs(client, { eventIds, scope: "current", dryRun: false });
  const job = client.prepare("SELECT id FROM ingestion_jobs").get() as {
    id: string;
  };
  const input = storedRunInput(
    {
      mode: "refresh",
      eventId: eventIds[0],
      scope: "current",
      dryRun: false,
      actor: "owner",
    },
    { apiKey: "fixture", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
    DEFAULT_RESEARCH_LIMITS,
  );
  const start = (overrides = {}, jobId = job.id) =>
    startIngestionRun(
      client,
      { ...input, ...overrides },
      Date.now(),
      eventIds[0],
      jobId,
    );
  expect(() => start()).toThrow();
  nextJob(client);
  for (const overrides of [
    { scope: "full" },
    { eventId: "other" },
    { mode: "add" },
    { dryRun: true },
    { republish: true },
  ]) {
    expect(() => start(overrides)).toThrow();
  }
  expect(() => start({}, "missing")).toThrow();
  const a = start(),
    b = start();
  expect(a).not.toBe(b);
  const direct = startIngestionRun(client, input, Date.now(), eventIds[0]);
  expect(
    client.prepare("SELECT job_id FROM ingestion_runs WHERE id=?").get(direct),
  ).toEqual({ job_id: null });
  const times = client
    .prepare("SELECT started_at,finished_at FROM ingestion_runs WHERE id=?")
    .get(a);
  expect(times).toEqual({ started_at: expect.any(String), finished_at: null });
  expect(
    client
      .prepare("SELECT count(*) n FROM ingestion_runs WHERE job_id=?")
      .get(job.id),
  ).toEqual({ n: 2 });
  expect(client.pragma("foreign_key_check")).toEqual([]);
  finishJob(client, job.id);
  expect(() => start()).toThrow();
});

test("opening job storage requires a migrated existing catalog", () => {
  const db = testDatabase();
  expect(() => openJobCatalog(join(dirname(db.path), "absent.sqlite"))).toThrow(
    "job_storage_unavailable",
  );
  const client = openJobCatalog(db.path);
  client.close();
});

test("SQL counts 200 jobs once and keeps multiple attempts visible within normal output limits", async () => {
  const { queryCatalog } =
    await import("../../mastra/catalog-assistant/tools/query-catalog/query");
  const { client, eventIds } = setup(200);
  const batch = submitJobs(client, { eventIds });
  const job = nextJob(client)!;
  const input = storedRunInput(
    { mode: "refresh", eventId: job.event_id, actor: "owner" },
    { apiKey: "fixture", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
    DEFAULT_RESEARCH_LIMITS,
  );
  const runIds = Array.from({ length: 3 }, () =>
    startIngestionRun(client, input, Date.now(), job.event_id, job.id),
  );
  const counts = queryCatalog(testDatabase().path, {
    sql: "SELECT status,count(*) FROM ingestion_jobs WHERE batch_id=? GROUP BY status ORDER BY status",
    parameters: [batch.batchId],
  });
  expect(counts).toMatchObject({
    ok: true,
    truncated: false,
    rows: [
      ["pending", 199],
      ["running", 1],
    ],
  });
  const attempts = queryCatalog(testDatabase().path, {
    sql: "SELECT r.id FROM ingestion_runs r JOIN ingestion_jobs j ON j.id=r.job_id WHERE j.batch_id=? ORDER BY r.rowid",
    parameters: [batch.batchId],
  });
  expect(attempts).toMatchObject({
    ok: true,
    truncated: false,
    rows: runIds.map((id) => [id]),
  });
  expect(
    queryCatalog(testDatabase().path, {
      sql: "SELECT id FROM ingestion_jobs WHERE batch_id=?",
      parameters: [batch.batchId],
    }),
  ).toMatchObject({ ok: true, rowCount: 200, truncated: false });
});

test("the lost-response discovery example reports when more than 200 batches match", async () => {
  const { queryCatalog } =
    await import("../../mastra/catalog-assistant/tools/query-catalog/query");
  const { client, eventIds } = setup(1);
  for (let i = 0; i < 201; i++) {
    submitJobs(client, { eventIds });
  }
  const guidance = readFileSync(
    new URL(
      "../../mastra/catalog-assistant/skills/catalog-sql/SKILL.md",
      import.meta.url,
    ),
    "utf8",
  );
  const sql = /discover candidates with `([^`]+)`/.exec(guidance)![1];
  expect(
    queryCatalog(testDatabase().path, {
      sql,
      parameters: ["2000-01-01", "2100-01-01"],
    }),
  ).toMatchObject({ ok: true, rowCount: 200, truncated: true });
  expect(
    client.prepare("SELECT count(*) FROM ingestion_jobs").pluck().get(),
  ).toBe(201);
});
