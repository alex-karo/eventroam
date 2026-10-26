import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { DEFAULT_RESEARCH_LIMITS } from "./runtime/budget";
import {
  startIngestionRun,
  finalizeIngestionRun,
  storedRunInput,
  RunPersistenceError,
} from "./runs";
import { runCatalogResearch } from "./workflow";

const settings = storedRunInput(
  { mode: "add", name: "Test", actor: "owner" },
  { apiKey: "secret", model: "fixture", limits: DEFAULT_RESEARCH_LIMITS },
  DEFAULT_RESEARCH_LIMITS,
);

test("fresh storage has 9 columns, no Event foreign key and accepts future mode names", () => {
  const { client } = testDatabase();
  expect(client.pragma("table_info('ingestion_runs')")).toHaveLength(9);
  expect(client.pragma("foreign_key_list('ingestion_runs')")).toEqual([]);
  const id = startIngestionRun(
    client,
    { ...settings, mode: "reconcile" },
    Date.now(),
    "deleted-event",
  );
  expect(
    client
      .prepare("SELECT mode,event_id FROM ingestion_runs WHERE id=?")
      .get(id),
  ).toEqual({ mode: "reconcile", event_id: "deleted-event" });
});

test.each([
  ["mode", ""],
  ["status", "unknown"],
  ["input_json", "not json"],
  ["input_json", "[]"],
  ["input_json", "{}"],
  ["input_json", '{"mode":"refresh"}'],
  ["report_json", "not json"],
  ["finished_at", "2026-10-09"],
  ["status", "completed"],
])("raw SQL bypasses application-owned running rule %s=%s", (column, value) => {
  const { client } = testDatabase();
  const id = startIngestionRun(client, settings, Date.now(), null);
  expect(() =>
    client
      .prepare(`UPDATE ingestion_runs SET ${column}=? WHERE id=?`)
      .run(value, id),
  ).not.toThrow();
});

test("finalization preserves normalized report, zero/unknown values and guards terminal rows", async () => {
  const { client } = testDatabase();
  const report = await runCatalogResearch(
    { mode: "add", name: "Test", actor: "owner" },
    {
      client,
      generateCandidate: async () => ({
        status: "failed",
        data: null,
        errors: [],
        unresolved: [],
      }),
    },
  );
  const id = startIngestionRun(client, settings, Date.now(), null);
  const final = {
    ...report,
    runId: id,
    budget: { ...report.budget },
  };
  const pending = client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(id);
  for (const schemaVersion of [2, 3, 4, 5]) {
    expect(() =>
      finalizeIngestionRun(
        client,
        id,
        { ...final, schemaVersion } as never,
        null,
        Date.now(),
      ),
    ).toThrow();
    expect(
      client.prepare("SELECT * FROM ingestion_runs WHERE id=?").get(id),
    ).toEqual(pending);
  }
  const invalidReports = [
    { ...final, mode: "refresh" },
    ...[-1, 1.5].map((pages) => ({
      ...final,
      budget: { ...final.budget, pages },
    })),
    { ...final, durationMs: -1 },
  ];
  for (const invalid of invalidReports) {
    expect(() =>
      finalizeIngestionRun(client, id, invalid as never, null, Date.now()),
    ).toThrow(RunPersistenceError);
    expect(
      client.prepare("SELECT * FROM ingestion_runs WHERE id=?").get(id),
    ).toEqual(pending);
  }
  const normalized = finalizeIngestionRun(client, id, final, null, Date.now());
  const row = client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(id) as Record<string, unknown>;
  expect(JSON.parse(row.report_json as string)).toEqual(normalized);
  expect(row).toMatchObject({
    status: "failed",
  });
  expect(() =>
    finalizeIngestionRun(client, id, final, null, Date.now()),
  ).toThrow(RunPersistenceError);
  expect(() =>
    finalizeIngestionRun(
      client,
      "missing",
      { ...final, runId: "missing" },
      null,
      Date.now(),
    ),
  ).toThrow(RunPersistenceError);
  expect(
    client.prepare("SELECT * FROM ingestion_runs WHERE id=?").get(id),
  ).toEqual(row);
  expect(() =>
    client
      .prepare("UPDATE ingestion_runs SET report_json='[]' WHERE id=?")
      .run(id),
  ).not.toThrow();
});

test.each([NaN, Infinity, -1, 1.5])(
  "invalid budget count %s cannot finalize a row",
  async (cost) => {
    const { client } = testDatabase();
    const report = await runCatalogResearch(
      { mode: "add", name: "Test", actor: "owner" },
      {
        client,
        generateCandidate: async () => ({
          status: "failed",
          data: null,
          errors: [],
          unresolved: [],
        }),
      },
    );
    const id = startIngestionRun(client, settings, Date.now(), null);
    expect(() =>
      finalizeIngestionRun(
        client,
        id,
        { ...report, runId: id, budget: { ...report.budget, searches: cost } },
        null,
        Date.now(),
      ),
    ).toThrow(RunPersistenceError);
    expect(
      client
        .prepare("SELECT status,report_json FROM ingestion_runs WHERE id=?")
        .get(id),
    ).toEqual({ status: "running", report_json: null });
  },
);

test("start stores only allowlisted settings and every final statistic begins null", () => {
  const { client } = testDatabase();
  const extended = {
    ...settings,
    markdown: "private page",
    eventContext: { name: "private snapshot" },
    apiKey: "secret",
    database: "/private",
  };
  const id = startIngestionRun(client, extended, Date.now(), null);
  const row = client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(id) as Record<string, unknown>;
  expect(JSON.parse(row.input_json as string)).toEqual(settings);
  expect(row).toMatchObject({
    status: "running",
    finished_at: null,
    report_json: null,
    event_id: null,
    duration_ms: null,
  });
});

test("start rejects empty modes and stores normalized mode consistently", () => {
  const { client } = testDatabase();
  for (const mode of ["", "  "]) {
    expect(() =>
      startIngestionRun(client, { ...settings, mode }, Date.now(), null),
    ).toThrow(RunPersistenceError);
  }
  expect(client.prepare("SELECT * FROM ingestion_runs").all()).toEqual([]);
  const id = startIngestionRun(
    client,
    { ...settings, mode: " reconcile " },
    Date.now(),
    null,
  );
  const row = client
    .prepare("SELECT mode,input_json FROM ingestion_runs WHERE id=?")
    .get(id) as { mode: string; input_json: string };
  expect(row.mode).toBe("reconcile");
  expect(JSON.parse(row.input_json).mode).toBe(row.mode);
});

test("a new run leaves historical report JSON unchanged", async () => {
  const { client } = testDatabase();
  const id = startIngestionRun(client, settings, Date.now(), null);
  const historical =
    '{ "schemaVersion": 5, "modelResponse": {"editions": []} }';
  client
    .prepare(
      "UPDATE ingestion_runs SET status='completed', report_json=? WHERE id=?",
    )
    .run(historical, id);
  const result = await runCatalogResearch(
    { mode: "add", name: "Test", actor: "owner" },
    {
      client,
      generateCandidate: async () => ({
        status: "failed",
        data: null,
        errors: [],
        unresolved: [],
      }),
    },
  );
  expect(result.schemaVersion).toBe(7);
  expect(result.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(
    client.prepare("SELECT report_json FROM ingestion_runs WHERE id=?").get(id),
  ).toEqual({ report_json: historical });
});

test("accounting migration preserves old rows and opaque report JSON", async () => {
  const { readFileSync } = await import("node:fs");
  const { client } = testDatabase();
  for (const column of [
    "input_tokens",
    "output_tokens",
    "model_cost_usd",
    "search_cost_estimate_usd",
    "usage_complete",
  ]) {
    client.exec(`ALTER TABLE ingestion_runs ADD COLUMN ${column} REAL`);
  }
  const id = startIngestionRun(client, settings, Date.now(), null);
  const historical = '{ "schemaVersion": 6, "usage": {"inputTokens": 12} }';
  client
    .prepare(
      "UPDATE ingestion_runs SET status='completed',finished_at=?,duration_ms=42,report_json=?,input_tokens=12 WHERE id=?",
    )
    .run("2026-10-24T12:00:00Z", historical, id);
  client.exec(
    readFileSync("src/db/migrations/0002_remove_run_accounting.sql", "utf8"),
  );
  const row = client.prepare("SELECT * FROM ingestion_runs WHERE id=?").get(id);
  expect(row).toMatchObject({
    id,
    status: "completed",
    duration_ms: 42,
    report_json: historical,
  });
  expect(row).not.toHaveProperty("input_tokens");
  expect(client.pragma("integrity_check", { simple: true })).toBe("ok");
});
