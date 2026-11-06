import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { BATCH_COUNTS_SQL, BATCH_JOBS_SQL } from "@/test/catalog-sql";
import { testFixtures } from "@/test/fixtures";
import { DEFAULT_RESEARCH_LIMITS } from "../runtime/budget";
import { startIngestionRun, storedRunInput } from "../runs";
import {
  submitAddJobs,
  jobWorkflowInput,
  submitJobs,
  nextJob,
  finishJob,
  cancelPendingJobs,
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
  expect(rows.map((row) => JSON.parse(row.input as string))).toEqual(
    eventIds.map((eventId) => ({ eventId, scope: "current" })),
  );
  expect(new Set(rows.map((row) => row.id)).size).toBe(200);
  expect(new Set(rows.map((row) => row.created_at)).size).toBe(1);
  expect(rows[0]).toMatchObject({
    batch_id: result.batchId,
    mode: "refresh",
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
  expect(jobWorkflowInput(first)).toMatchObject({
    input: { eventId: eventIds[0] },
  });
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

test("SQL counts 200 jobs once and keeps multiple attempts visible within normal output limits", async () => {
  const { queryCatalog } =
    await import("../../mastra/catalog-assistant/tools/query-catalog/query");
  const { client, eventIds } = setup(200);
  const batch = submitJobs(client, { eventIds });
  const job = nextJob(client)!;
  const input = storedRunInput(
    { mode: "refresh", eventId: eventIds[0], actor: "owner" },
    { apiKey: "fixture", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
    DEFAULT_RESEARCH_LIMITS,
  );
  const runIds = Array.from({ length: 3 }, () =>
    startIngestionRun(client, input, Date.now(), eventIds[0], job.id),
  );
  const counts = queryCatalog(testDatabase().path, {
    sql: BATCH_COUNTS_SQL,
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
      sql: BATCH_JOBS_SQL,
      parameters: [batch.batchId],
    }),
  ).toMatchObject({
    ok: true,
    rowCount: 200,
    truncated: false,
    rows: expect.arrayContaining([
      [
        job.id,
        0,
        "refresh",
        1,
        "running",
        job.created_at,
        eventIds[0],
        "full",
        null,
      ],
    ]),
  });
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

test("add batches preserve full notes and reject the complete invalid selection", () => {
  const { client } = setup(0);
  const note = `  tentative festival\n${"Clue. ".repeat(12000)}\nhttps://organizer.test/last-line\n`;
  for (const inputs of [[], ["valid", " \n"], Array(201).fill("valid")]) {
    expect(() => submitAddJobs(client, { inputs })).toThrow(
      "invalid_selection",
    );
  }
  expect(
    client.prepare("SELECT count(*) FROM ingestion_jobs").pluck().get(),
  ).toBe(0);
  const accepted = submitAddJobs(client, {
    inputs: [note, "https://second.test/"],
  });
  expect(accepted.acceptedCount).toBe(2);
  const job = nextJob(client)!;
  expect(job).toMatchObject({
    mode: "add",
    input: JSON.stringify(note),
    dry_run: 1,
  });
  const input = jobWorkflowInput(job);
  if (input.mode !== "add") {
    throw new Error("Expected an add job");
  }
  const stored = storedRunInput(
    { ...input, actor: "owner" },
    { apiKey: "fixture", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
    DEFAULT_RESEARCH_LIMITS,
  );
  for (const overrides of [
    { input: note.trim() },
    { scope: "full" as const },
    { eventId: "candidate" },
    { dryRun: false },
    { republish: true },
    { mode: "refresh" },
  ]) {
    expect(() =>
      startIngestionRun(
        client,
        { ...stored, ...overrides },
        Date.now(),
        null,
        job.id,
      ),
    ).toThrow();
  }
  startIngestionRun(client, stored, Date.now(), null, job.id);
  expect(
    JSON.parse(
      client
        .prepare("SELECT input_json FROM ingestion_runs")
        .pluck()
        .get() as string,
    ).input,
  ).toBe(note);
  for (const row of [
    { ...job, mode: "refresh" as const },
    { ...job, input: '{"eventId":"mixed","scope":"full"}' },
    { ...job, input: "null" },
    { ...job, input: "invalid JSON" },
    { ...job, dry_run: 2 },
  ]) {
    expect(() => jobWorkflowInput(row)).toThrow();
  }
  expect(cancelPendingJobs(client, accepted.batchId).cancelledCount).toBe(1);
  expect(nextJob(client)?.id).toBe(job.id);
});

test("SQL counts and bounded add details work when one note exceeds the result limit", async () => {
  const { queryCatalog } =
    await import("../../mastra/catalog-assistant/tools/query-catalog/query");
  const { client } = setup(0);
  const note = "x".repeat(70000) + "\nLAST_LINE";
  const batch = submitAddJobs(client, {
    inputs: [note, ...Array(199).fill("Event clue")],
  });
  const job = nextJob(client)!;
  const input = storedRunInput(
    { mode: "add", input: note, actor: "owner" },
    { apiKey: "fixture", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
    DEFAULT_RESEARCH_LIMITS,
  );
  for (let i = 0; i < 2; i++) {
    startIngestionRun(client, input, Date.now(), null, job.id);
  }
  const query = (sql: string) =>
    queryCatalog(testDatabase().path, { sql, parameters: [batch.batchId] });
  expect(query(BATCH_COUNTS_SQL)).toMatchObject({
    ok: true,
    truncated: false,
    rows: [
      ["pending", 199],
      ["running", 1],
    ],
  });
  expect(query(BATCH_JOBS_SQL)).toMatchObject({
    ok: true,
    rowCount: 200,
    truncated: false,
    rows: expect.arrayContaining([
      [
        job.id,
        0,
        "add",
        1,
        "running",
        job.created_at,
        null,
        null,
        note.slice(0, 160),
      ],
    ]),
  });
  expect(
    client
      .prepare("SELECT json_extract(input,'$') FROM ingestion_jobs WHERE id=?")
      .pluck()
      .get(job.id),
  ).toBe(note);
});
