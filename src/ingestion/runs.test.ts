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

test("fresh storage has 14 columns, no Event foreign key and accepts future mode names", () => {
  const { client } = testDatabase();
  expect(client.pragma("table_info('ingestion_runs')")).toHaveLength(14);
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
  ["input_tokens", 0],
  ["usage_complete", 0],
  ["status", "completed"],
])("SQLite rejects invalid running %s=%s", (column, value) => {
  const { client } = testDatabase();
  const id = startIngestionRun(client, settings, Date.now(), null);
  expect(() =>
    client
      .prepare(`UPDATE ingestion_runs SET ${column}=? WHERE id=?`)
      .run(value, id),
  ).toThrow();
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
    usage: { ...report.usage, inputTokens: 10, modelCostUsd: 0 },
  };
  const normalized = finalizeIngestionRun(client, id, final, null, Date.now());
  const row = client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(id) as Record<string, unknown>;
  expect(JSON.parse(row.report_json as string)).toEqual(normalized);
  expect(row).toMatchObject({
    status: "failed",
    input_tokens: 10,
    output_tokens: 0,
    model_cost_usd: 0,
    search_cost_estimate_usd: 0,
    usage_complete: 0,
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
  for (const [column, value] of [
    ["input_tokens", -1],
    ["input_tokens", 1.5],
    ["model_cost_usd", -1],
    ["duration_ms", -1],
    ["usage_complete", 2],
    ["report_json", "[]"],
    ["finished_at", null],
  ] as const) {
    expect(() =>
      client
        .prepare(`UPDATE ingestion_runs SET ${column}=? WHERE id=?`)
        .run(value, id),
    ).toThrow();
  }
});

test("version-2 reports with historical page and model-call limits remain readable", async () => {
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
  finalizeIngestionRun(client, id, { ...report, runId: id }, null, Date.now());
  client
    .prepare(
      `UPDATE ingestion_runs SET
    input_json=json_set(input_json, '$.limits.pages', 20, '$.limits.modelCalls', 10),
    report_json=json_set(report_json, '$.usage.remaining.pages', 19, '$.usage.remaining.modelCalls', 9)
    WHERE id=?`,
    )
    .run(id);
  const row = client
    .prepare("SELECT input_json,report_json FROM ingestion_runs WHERE id=?")
    .get(id) as {
    input_json: string;
    report_json: string;
  };
  expect(JSON.parse(row.input_json).limits).toMatchObject({
    pages: 20,
    modelCalls: 10,
  });
  expect(JSON.parse(row.report_json)).toMatchObject({
    schemaVersion: 2,
    usage: { remaining: { pages: 19, modelCalls: 9 } },
  });
});

test.each([NaN, Infinity, -1])(
  "invalid cost %s cannot finalize a row",
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
        {
          ...report,
          runId: id,
          usage: { ...report.usage, modelCostUsd: cost },
        },
        null,
        Date.now(),
      ),
    ).toThrow(RunPersistenceError);
    expect(
      client
        .prepare(
          "SELECT status,report_json,input_tokens FROM ingestion_runs WHERE id=?",
        )
        .get(id),
    ).toEqual({ status: "running", report_json: null, input_tokens: null });
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
    input_tokens: null,
    output_tokens: null,
    model_cost_usd: null,
    search_cost_estimate_usd: null,
    duration_ms: null,
    usage_complete: null,
  });
});
