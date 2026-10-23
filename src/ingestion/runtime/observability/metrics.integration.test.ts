import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import type { ObservabilityStorage } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
import { runTraceFixture, readTraceRows } from "@/test/tracing-fixture";
import {
  createRunObservability,
  finishRunObservability,
  ResearchObservabilityExporter,
} from "./runtime";

const directories: string[] = [];
function path() {
  const directory = mkdtempSync(join(tmpdir(), "ingestion-metrics-"));
  directories.push(directory);
  const file = join(directory, "observability.duckdb");
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_LOGGING", "false");
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", file);
  return file;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});
const totals = [
  "mastra_model_total_input_tokens",
  "mastra_model_total_output_tokens",
];

async function inspect<T>(
  file: string,
  action: (domain: ObservabilityStorage) => Promise<T>,
) {
  const storage = new DuckDBStore({ path: file });
  await storage.init();
  try {
    return await action((await storage.getStore("observability"))!);
  } finally {
    await storage.close();
  }
}

test("real research/editor lifecycles retain native usage/cost and persist native correlated metrics", async () => {
  const file = path();
  const events: { type: string; span: Record<string, unknown> }[] = [];
  const original = ResearchObservabilityExporter.prototype._exportTracingEvent;
  vi.spyOn(
    ResearchObservabilityExporter.prototype,
    "_exportTracingEvent",
  ).mockImplementation(async function (
    this: ResearchObservabilityExporter,
    event,
  ) {
    events.push({
      type: event.type,
      span: JSON.parse(JSON.stringify(event.exportedSpan)),
    });
    await original.call(this, event);
  });
  const { result, durableReport } = await runTraceFixture(
    "success",
    false,
    "partial",
    false,
    { cost: 0.012 },
  );
  expect(durableReport).toEqual(result);
  const rows = await readTraceRows(file);
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_");
  expect(rows.mastra_logs).toEqual([]);
  for (const agent of ["festival-research", "festival-editor"]) {
    const generations = events.filter(
      ({ span }) => span.type === "model_generation" && span.entityId === agent,
    );
    expect(new Set(generations.map(({ type }) => type))).toEqual(
      new Set(["span_started", "span_ended"]),
    );
    const ended = generations.find(({ type }) => type === "span_ended")!.span;
    expect(ended).toMatchObject({
      entityType: "agent",
      entityName:
        agent === "festival-research" ? "Festival research" : "Festival editor",
      attributes: {
        provider: "openrouter",
        model: "fixture/provider-model",
        responseModel: "fixture/provider-model",
        usage: {
          inputDetails: { cacheRead: expect.any(Number) },
          outputDetails: { reasoning: expect.any(Number) },
        },
        costContext: {
          estimatedCost: agent === "festival-research" ? 0.024 : 0.012,
          costMetadata: { source: "provider_reported" },
        },
      },
    });
    const metrics = rows.mastra_metrics.filter((row) => row.entityId === agent);
    expect(metrics.some((row) => row.name === "mastra_agent_duration_ms")).toBe(
      true,
    );
    expect(
      metrics.some(
        (row) => row.name === "mastra_model_input_cache_read_tokens",
      ),
    ).toBe(true);
    expect(
      metrics.some(
        (row) => row.name === "mastra_model_output_reasoning_tokens",
      ),
    ).toBe(true);
    expect(metrics.filter((row) => row.name === totals[0])).toMatchObject([
      {
        model: "fixture/provider-model",
        estimatedCost: agent === "festival-research" ? 0.024 : 0.012,
      },
    ]);
  }
  for (const metric of rows.mastra_metrics) {
    expect(metric.runId).toBe(result.runId);
    expect(
      rows.mastra_ai_spans.some(
        (span) =>
          span.spanId === metric.spanId && span.traceId === metric.traceId,
      ),
    ).toBe(true);
    expect(metric.rootEntityId).toBe("catalog-research");
    expect(metric.labels).not.toHaveProperty("runId");
  }
  expect(
    rows.mastra_metrics.find((row) => row.name === "mastra_tool_duration_ms"),
  ).toMatchObject({ entityName: "readPage", labels: { status: "ok" } });
  await inspect(file, async (domain) => {
    const { groups } = await domain.getMetricBreakdown({
      name: totals,
      aggregation: "sum",
      groupBy: ["entityId", "model"],
    });
    expect(groups).toHaveLength(2);
    for (const [entityId, tokens, cost] of [
      ["festival-research", 60, 0.024],
      ["festival-editor", 30, 0.012],
    ] as const) {
      expect(
        groups.find((g) => g.dimensions.entityId === entityId),
      ).toMatchObject({
        dimensions: { model: "fixture/provider-model" },
        value: tokens,
        estimatedCost: cost,
        costUnit: "USD",
      });
    }
  });
});

test.each([
  {
    costs: [0, 0],
    model: "fixture/provider-model",
    cost: 0,
    basis: "provider_reported",
  },
  {
    costs: [0.012, null],
    model: "fixture/provider-model",
    cost: null,
  },
  { costs: [0.012, null], model: "openai/gpt-4.1-mini", basis: "pricing" },
])(
  "SDK cost basis for $model / $costs survives projection",
  async ({ costs, model, cost, basis }) => {
    const file = path();
    const { result } = await runTraceFixture(
      "success",
      false,
      "failed",
      false,
      { model, stepCosts: costs },
    );
    const records = (await readTraceRows(file)).mastra_metrics;
    const input = records.find((row) => row.name === totals[0])!;
    if (basis === "pricing") {
      expect(input.estimatedCost).toBeGreaterThan(0);
      expect(input.costMetadata).toMatchObject({
        pricing_id: expect.any(String),
      });
      expect(result.usage.modelCostUsd).toBe(0.012); // report keeps the known subtotal
    } else {
      expect(input.estimatedCost).toBe(cost);
      if (basis) {
        expect(input.costMetadata).toMatchObject({ source: basis });
      } else {
        expect(input.costMetadata).not.toHaveProperty("source");
      }
    }
    await inspect(file, async (domain) => {
      const aggregate = await domain.getMetricAggregate({
        name: totals,
        aggregation: "sum",
      });
      expect(aggregate.value).toBe(60); // cache/reasoning are subsets
      expect(aggregate.estimatedCost ?? null).toBe(
        basis === "pricing"
          ? records
              .filter((r) => totals.includes(r.name))
              .reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0)
          : cost,
      );
    });
  },
);

const input = {
  mode: "add" as const,
  name: "Fixture",
  actor: "test",
  dryRun: false,
};
test.each(["off", "preview", "injected"])(
  "%s rejects automatic and direct metrics while retaining logging",
  async (mode) => {
    const file = path();
    vi.stubEnv("CATALOG_LOGGING", "true");
    if (mode === "off") {
      vi.stubEnv("CATALOG_TRACING", "false");
    }
    const run = (await createRunObservability(
      { ...input, dryRun: mode === "preview" },
      "fixture/model",
      "ineligible-run",
      mode === "injected",
    ))!;
    run.observability.getDefaultInstance()!.getMetricsContext!().emit(
      totals[0],
      10,
    );
    const exporter = run.observability
      .getDefaultInstance()!
      .getExporters()[0] as ResearchObservabilityExporter;
    await exporter.onMetricEvent({
      type: "metric",
      metric: {
        metricId: "direct-id",
        name: totals[0],
        value: 10,
        labels: {},
        timestamp: new Date(),
      },
    });
    run.log?.info("Fixture event");
    await finishRunObservability(run);
    const rows = await readTraceRows(file);
    expect(rows.mastra_metrics).toEqual([]);
    expect(rows.mastra_logs).toHaveLength(1);
  },
);

test("a metric storage failure cannot change the durable report or catalog outcome", async () => {
  path();
  vi.stubEnv("CATALOG_TRACING", "false");
  const baseline = await runTraceFixture("success", false, "partial", false, {
    cost: 0.012,
  });
  vi.stubEnv("CATALOG_TRACING", "true");
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const storage = await import("@mastra/duckdb");
  vi.spyOn(
    storage.ObservabilityStorageDuckDB.prototype,
    "batchCreateMetrics",
  ).mockRejectedValue(new Error("PRIVATE_METRIC_WRITE"));
  const observed = await runTraceFixture("success", false, "partial", false, {
    cost: 0.012,
  });
  expect(observed.result.usage).toMatchObject({
    inputTokens: baseline.result.usage.inputTokens,
    outputTokens: baseline.result.usage.outputTokens,
    modelCostUsd: baseline.result.usage.modelCostUsd,
    complete: baseline.result.usage.complete,
  });
  expect(observed.result).toMatchObject({
    schemaVersion: 6,
    outcome: baseline.result.outcome,
    researchStatus: baseline.result.researchStatus,
    editorStatus: baseline.result.editorStatus,
  });
  expect(observed.requests).toBe(baseline.requests);
  expect(observed.effects).toEqual(baseline.effects);
  expect(observed.durableReport).toEqual(observed.result);
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
    "trace_export_failed\n",
  );
});
