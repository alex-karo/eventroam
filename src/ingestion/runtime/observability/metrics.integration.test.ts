import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { SpanType, type MetricEvent } from "@mastra/core/observability";
import type { ObservabilityStorage } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraStorageExporter } from "@mastra/observability";
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

test("real research/editor lifecycles retain native usage/cost and persist correlated safe metrics", async () => {
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
    expect(metric.rootEntityName).toBe("catalog-research");
    expect(metric.labels).not.toHaveProperty("runId");
  }
  expect(
    rows.mastra_metrics.find((row) => row.name === "mastra_tool_duration_ms"),
  ).toMatchObject({ entityName: "readPage", labels: { status: "ok" } });
  await inspect(file, async (domain) => {
    const { groups } = await domain.getMetricBreakdown({
      name: totals,
      aggregation: "sum",
      groupBy: ["entityName", "model"],
    });
    expect(groups).toHaveLength(2);
    for (const [entityName, tokens, cost] of [
      ["Festival research", 60, 0.024],
      ["Festival editor", 30, 0.012],
    ] as const) {
      expect(
        groups.find((g) => g.dimensions.entityName === entityName),
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
      expect(input.costMetadata).toEqual({ pricing_id: expect.any(String) });
      expect(result.usage.modelCostUsd).toBe(0.012); // report keeps the known subtotal
    } else {
      expect(input.estimatedCost).toBe(cost);
      expect(input.costMetadata).toEqual(basis ? { source: basis } : {});
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
test("cached and spanless metrics retain new names without arbitrary content or invented correlation", async () => {
  const file = path();
  const metricNames = [totals[0], "future_sdk_observation"];
  const run = (await createRunObservability(
    input,
    "fixture/model",
    "durable-run",
  ))!;
  const instance = run.observability.getDefaultInstance()!;
  const agent = run.root!.createChildSpan({
    type: SpanType.AGENT_RUN,
    name: "PRIVATE_DISPLAY",
    entityId: "festival-editor",
    metadata: { secret: "PRIVATE_METADATA" },
  });
  const metrics = instance.getMetricsContext!(agent);
  const options = {
    costContext: {
      provider: "openrouter",
      model: "fixture/model",
      estimatedCost: 0.5,
      costUnit: "USD",
      costMetadata: {
        source: "provider_reported",
        sdkProvider: "openrouter",
        sdkCostField: "openrouter.usage.cost",
        scope: "query_total",
        allocation: "query_total",
        error: "partial_cost",
        reportedStepCount: 2,
        tier_index: 0,
        prompt: "PRIVATE_COST",
        nested: { body: "PRIVATE_BODY" },
      },
    },
  };
  metrics.emit(
    metricNames[0],
    10,
    { status: "PRIVATE_STATUS", query: "PRIVATE_QUERY", runId: "PRIVATE_RUN" },
    options,
  );
  instance.getMetricsContext!().emit(
    metricNames[1],
    20,
    { url: "PRIVATE_URL" },
    options,
  );
  agent.end();
  await finishRunObservability(run);
  const rows = await readTraceRows(file);
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_");
  const observations = rows.mastra_metrics.filter((r) =>
    metricNames.includes(r.name),
  );
  expect(observations).toHaveLength(2);
  expect(observations.find((r) => r.name === metricNames[0])).toMatchObject({
    entityName: "Festival editor",
    spanId: agent.id,
    traceId: agent.traceId,
    labels: {},
  });
  expect(observations[0].costMetadata).toEqual({ source: "provider_reported" });
  expect(observations.find((r) => r.name === metricNames[1])).toMatchObject({
    value: 20,
    traceId: null,
    spanId: null,
    runId: "durable-run",
    labels: {},
  });
});

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

test("invalid metric fields are dropped with a fixed diagnostic", async () => {
  const diagnose = vi.fn();
  const exporter = new ResearchObservabilityExporter(diagnose, true, "run");
  const forward = vi.spyOn(MastraStorageExporter.prototype, "onMetricEvent");
  const event: MetricEvent = {
    type: "metric",
    metric: {
      metricId: "id",
      name: totals[0],
      value: NaN,
      timestamp: new Date(),
      labels: {},
    },
  };
  await exporter.onMetricEvent(event);
  event.metric.value = 10;
  for (const name of ["", "PRIVATE NAME\nBODY", "x".repeat(161)]) {
    await exporter.onMetricEvent({
      ...event,
      metric: { ...event.metric, name },
    });
  }
  Object.defineProperty(event.metric, "value", {
    get() {
      throw new Error("PRIVATE_GETTER");
    },
  });
  await exporter.onMetricEvent(event);
  expect(forward).not.toHaveBeenCalled();
  expect(diagnose.mock.calls).toEqual([
    ["trace_sanitization_failed"],
    ["trace_sanitization_failed"],
    ["trace_sanitization_failed"],
    ["trace_sanitization_failed"],
    ["trace_sanitization_failed"],
  ]);
});

test("live model updates preserve only native numeric and cost selections", async () => {
  const file = path();
  const run = (await createRunObservability(
    input,
    "fixture/model",
    "update-run",
  ))!;
  const model = run.root!.createChildSpan({
    type: SpanType.MODEL_GENERATION,
    name: "PRIVATE_NAME",
    entityId: "festival-research",
    attributes: { provider: "openrouter", model: "fixture/model" },
  });
  model.update({
    attributes: {
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        inputDetails: { cacheRead: 30, cacheWrite: -1 },
        outputDetails: { reasoning: 5, audio: Infinity },
      },
      costContext: {
        estimatedCost: 0.012,
        costUnit: "USD",
        costMetadata: {
          source: "provider_reported",
          response: "PRIVATE_RESPONSE",
        },
      },
      parameters: { headers: { Authorization: "PRIVATE_SECRET" } },
    },
  });
  expect(model.attributes).toMatchObject({
    usage: {
      inputDetails: { cacheRead: 30, cacheWrite: undefined },
      outputDetails: { reasoning: 5, audio: undefined },
    },
  });
  expect(JSON.stringify(model.exportSpan())).not.toContain("PRIVATE_");
  model.end();
  await finishRunObservability(run);
  expect(JSON.stringify(await readTraceRows(file))).not.toContain("PRIVATE_");
});

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
    schemaVersion: 5,
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

test("unfinished writer observation keeps an unknown count through root persistence", async () => {
  const file = path();
  const { createCatalogRunTrace } = await import("../tracing/run");
  const trace = (await createCatalogRunTrace(
    input,
    "fixture/model",
    "pending-run",
    false,
  ))!;
  trace.state.writeState = "unknown";
  trace.update({ phase: "write" });
  await trace.finish();
  const root = (await readTraceRows(file)).mastra_ai_spans.find(
    (span) => !span.parentSpanId,
  )!;
  expect(JSON.parse(root.output as string)).toMatchObject({
    writeState: "unknown",
    committedOperationCount: null,
  });
});
