import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { LOCATION_PROMPT_VERSION } from "../../location/contracts";
import { RESEARCH_PROMPT_VERSION } from "../../research/contracts";
import {
  readTraceRows,
  runTraceFixture as executeTraceFixture,
  TRACE_ERROR,
  TRACE_CREDENTIAL,
  TRACE_SOURCE_BODY,
  TRACE_HIGHLIGHT,
  TRACE_CANDIDATE,
  TRACE_TRANSPORT,
  TRACE_PUBLIC_MARKER,
  TRACE_PUBLIC_URL,
} from "@/test/tracing-fixture";
// Advance the real SDK deadline only after its second request is hanging.
async function runTraceFixture(
  ...args: Parameters<typeof executeTraceFixture>
) {
  if (args[0] !== "abort") {
    return executeTraceFixture(...args);
  }
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  try {
    let ready!: () => void;
    const hanging = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const pending = executeTraceFixture(args[0], args[1], args[2], args[3], {
      ...args[4],
      onAbortRequest: ready,
    });
    await Promise.race([
      hanging,
      pending.then(() => {
        throw new Error("Abort fixture completed before its hanging request");
      }),
    ]);
    await vi.advanceTimersByTimeAsync(5_000);
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

const execute = promisify(execFile);
const dirs: string[] = [];
function tracePath() {
  const dir = mkdtempSync(join(tmpdir(), "trace-integration-"));
  dirs.push(dir);
  return join(dir, "traces.duckdb");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
function enable(path: string) {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", path);
}
async function spansAt(path: string) {
  const rows = await readTraceRows(path);
  const spans = rows.mastra_ai_spans as Record<string, unknown>[];
  expect(spans.length).toBeGreaterThan(0);
  for (const marker of [
    TRACE_ERROR,
    TRACE_CREDENTIAL,
    TRACE_SOURCE_BODY,
    TRACE_HIGHLIGHT,
    TRACE_CANDIDATE,
    TRACE_TRANSPORT,
  ]) {
    expect(JSON.stringify(rows)).not.toContain(marker);
  }
  expect(rows.mastra_logs).toEqual([]);
  return spans;
}

test("offline real agent persists sanitized model/tool relationships and bounded metadata", async () => {
  const path = tracePath();
  enable(path);
  const result = await runTraceFixture();
  expect(result.requests).toBe(2);
  expect(result.result).toMatchObject({
    researchStatus: "failed",
  });
  expect(result.durableReport).toEqual(result.result);
  expect(JSON.stringify(result.result.modelResponse)).toContain(
    TRACE_CANDIDATE,
  );
  const spans = await spansAt(path);
  expect(spans.map((span) => span.spanType)).toEqual(
    expect.arrayContaining([
      "agent_run",
      "model_generation",
      "model_step",
      "tool_call",
    ]),
  );
  const root = spans.find((span) => !span.parentSpanId)!;
  expect(spans.filter((span) => !span.parentSpanId)).toHaveLength(1);
  expect(new Set(spans.map((span) => span.traceId))).toEqual(
    new Set([root.traceId]),
  );
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  expect(byId.size).toBe(spans.length);
  for (const span of spans) {
    const visited = new Set();
    let current = span;
    while (current.parentSpanId) {
      expect(visited.has(current.spanId)).toBe(false);
      visited.add(current.spanId);
      expect(byId.has(current.parentSpanId)).toBe(true);
      current = byId.get(current.parentSpanId)!;
    }
    expect(current.spanId).toBe(root.spanId);
  }
  expect(
    spans.find((span) => span.spanType === "agent_run")?.parentSpanId,
  ).toBe(root.spanId);
  expect(root.error).toBeNull(); // A domain failed envelope is technically complete.
  expect(root.entityId).toBe("catalog-research");
  expect(root.name).toBe(root.entityName);
  expect(root.name).toContain(TRACE_PUBLIC_MARKER);
  expect(root.name).toContain("ctx:2026");
  expect(JSON.parse(root.output as string)).toMatchObject({
    researchStatus: "failed",
    semanticValidation: "not_run",
  });
  expect(JSON.parse(root.metadata as string).runId).toBe(result.result.runId);
  const reads = spans.filter((span) => span.entityId === "readPage");
  expect(reads).toHaveLength(2);
  for (const read of reads) {
    const output = JSON.parse(read.output as string);
    expect(output).toHaveProperty("status");
    for (const field of [
      "outcome",
      "reason",
      "completeness",
      "sourceTruncated",
      "toolTruncated",
      "markdown",
      "links",
    ]) {
      expect(output).not.toHaveProperty(field);
    }
    if (read.spanType !== "tool_call") {
      expect(output).not.toHaveProperty("truncated");
    }
  }
  expect(
    reads.some((span) => JSON.stringify(span).includes(TRACE_PUBLIC_URL)),
  ).toBe(true);
  expect(
    reads.some(
      (span) =>
        JSON.parse(span.output as string).reasonCode === "request_failed",
    ),
  ).toBe(true);
  expect(spans.every((span) => span.endedAt)).toBe(true);
});

test.each(["http", "abort"] as const)(
  "%s retains final spans, original errors, partial usage and no retry",
  async (ending) => {
    const path = tracePath();
    enable(path);
    const { result, requests } = await runTraceFixture(ending);
    expect(requests).toBe(2);
    expect(result).toMatchObject({});
    const saved = await readTraceRows(path);
    const root = saved.mastra_ai_spans.find((span) => !span.parentSpanId)!;
    expect(
      saved.mastra_metrics.some(
        (metric) =>
          metric.name === "mastra_model_duration_ms" &&
          metric.runId === result.runId,
      ),
    ).toBe(true);
    const tokens = saved.mastra_metrics.find(
      (metric) => metric.name === "mastra_model_total_input_tokens",
    );
    if (ending === "http") {
      expect(tokens).toMatchObject({ value: 10, runId: result.runId });
    } else {
      // Native cancellation can close a generation before SDK usage is attached.
      // The independent report above still retains the completed step's usage.
      expect(tokens).toBeUndefined();
    }
    expect(JSON.parse(root.error as string)).toMatchObject({
      message: "operation_failed",
    });
    expect(JSON.parse(root.output as string)).toMatchObject({
      researchStatus: "failed",
    });
  },
  15_000,
);

test.each([false, true])(
  "tracing follows the setting for injected=%s",
  async (injected) => {
    const path = tracePath();
    enable(path);
    if (!injected) {
      vi.stubEnv("CATALOG_TRACING", "false");
    }
    await runTraceFixture("success", injected);
    expect(existsSync(path)).toBe(injected);
  },
);

test.each(["http", "abort"] as const)(
  "cleanup crossing the deadline preserves the original %s result",
  async (ending) => {
    vi.stubEnv("CATALOG_TRACING", "false");
    const baseline = await runTraceFixture(ending);
    enable(tracePath());
    const originalNow = Date.now;
    const originalFlush = Observability.prototype.flush;
    vi.spyOn(Observability.prototype, "flush").mockImplementation(
      async function (this: Observability) {
        await originalFlush.call(this);
        // Only cleanup crosses the deadline; provider execution uses the real clock.
        const afterDeadline = originalNow() + 60_000;
        vi.spyOn(Date, "now").mockReturnValue(afterDeadline);
      },
    );
    const traced = await runTraceFixture(ending);
    expect(normalize(traced.result)).toEqual(normalize(baseline.result));
    expect(traced.requests).toBe(baseline.requests);
    expect(traced.result).toMatchObject({
      researchStatus: "failed",
      errors: [
        ending === "http"
          ? {
              code: "model_failed",
              diagnostic: expect.objectContaining({ httpStatus: 503 }),
            }
          : { code: "limit_reached" },
      ],
    });
  },
  15_000,
);

test("tracing initialization failure falls back to identical research", async () => {
  const path = tracePath();
  enable(path);
  vi.stubEnv("DATABASE_PATH", path); // Forbidden store selection triggers fallback.
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const { result, requests } = await runTraceFixture();
  expect(result.researchStatus).toBe("failed");
  expect(requests).toBe(2);
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
    "trace_initialization_failed\n",
  );
  expect(existsSync(path)).toBe(false);
});

test.each(["success", "http", "abort"] as const)(
  "cleanup failures do not replace the %s result",
  async (ending) => {
    const path = tracePath();
    enable(path);
    const originalShutdown = Mastra.prototype.shutdown;
    const shutdown = vi
      .spyOn(Mastra.prototype, "shutdown")
      .mockImplementation(async function (this: Mastra) {
        await originalShutdown.call(this);
        throw new Error(TRACE_ERROR);
      });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(Observability.prototype, "flush").mockRejectedValue(
      new Error(TRACE_ERROR),
    );
    const { result, requests } = await runTraceFixture(ending);
    expect(shutdown).toHaveBeenCalledOnce();
    expect(requests).toBe(2);
    expect(result).not.toHaveProperty("usage");

    const codes = stderr.mock.calls.map((call) => call[0]).join("");
    expect(codes).toContain("trace_flush_failed\n");
    expect(codes).toContain("trace_shutdown_failed\n");
    expect(codes).not.toContain(TRACE_ERROR);
  },
  15_000,
);

test("short buffered writer exits and a different process can read its final spans", async () => {
  const path = tracePath();
  const env = {
    ...process.env,
    CATALOG_TRACING: "true",
    CATALOG_OBSERVABILITY_DATABASE_PATH: path,
  };
  const script = resolve("src/test/tracing-fixture.ts");
  const writer = await execute(
    process.execPath,
    ["--import", "tsx", script, "write"],
    { env },
  );
  expect(JSON.parse(writer.stdout).result.researchStatus).toBe("failed");
  expect(JSON.parse(writer.stdout).durationMs).toBeLessThan(5_000);
  expect(writer.stderr).toBe("");
  const reader = await execute(
    process.execPath,
    ["--import", "tsx", script, "read"],
    { env },
  );
  for (const marker of [
    TRACE_ERROR,
    TRACE_CREDENTIAL,
    TRACE_SOURCE_BODY,
    TRACE_HIGHLIGHT,
    TRACE_CANDIDATE,
    TRACE_TRANSPORT,
  ]) {
    expect(reader.stdout).not.toContain(marker);
  }
  const saved = await readTraceRows(path);
  expect(
    saved.mastra_metrics.some(
      (metric) =>
        metric.name === "mastra_model_total_input_tokens" &&
        metric.value === 20,
    ),
  ).toBe(true);
  expect(
    saved.mastra_metrics.every(
      (metric) => metric.runId === JSON.parse(writer.stdout).result.runId,
    ),
  ).toBe(true);
  await spansAt(path);
}, 15_000);

function normalize(
  result: Awaited<ReturnType<typeof runTraceFixture>>["result"],
) {
  const copy = structuredClone(result);
  delete copy.runId;
  delete copy.traceId;
  copy.durationMs = 0;
  if (copy.currentDate) {
    copy.currentDate = "TIMESTAMP";
  }
  for (const change of copy.changes) {
    if (change.field === "created_at" || change.field === "updated_at") {
      change.newValue = "TIMESTAMP";
    }
  }
  copy.budget.elapsedMs = 0;
  copy.budget.remaining.durationMs = 0;
  return JSON.parse(
    JSON.stringify(copy).replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      "UUID",
    ),
  );
}

test.each([
  "cached",
  "truncated",
  "tool_truncated",
  "partial",
  "mistaken",
  "recovered",
  "invalid",
  "invalid_editor",
  "rejected_editor",
  "unchanged",
  "search",
  "reserved",
  "target",
  "skipped",
] as const)(
  "%s apply fixture persists safe trace projections and its durable report",
  async (scenario) => {
    // Compare on/off for committed, structurally invalid, unchanged and wrong-target
    // outcomes. Other scenarios still exercise their unique persisted trace fields.
    const compareBaseline = [
      "partial",
      "invalid",
      "unchanged",
      "target",
    ].includes(scenario);
    let baseline: Awaited<ReturnType<typeof runTraceFixture>> | undefined;
    if (compareBaseline) {
      vi.stubEnv("CATALOG_TRACING", "false");
      baseline = await runTraceFixture("success", false, scenario);
    }
    const path = tracePath();
    enable(path);
    const traced = await runTraceFixture("success", false, scenario);
    if (baseline) {
      expect(normalize(traced.result)).toEqual(normalize(baseline.result));
      expect(traced.effects).toEqual(baseline.effects);
      expect(traced.requests).toBe(baseline.requests);
    }
    expect(traced.durableReport).toEqual(traced.result);
    const spans = await spansAt(path);
    const root = spans.find((span) => !span.parentSpanId)!;
    const output = JSON.parse(root.output as string);
    expect(root.entityName).toBe(root.name);
    expect(output).toMatchObject({
      researchStatus: traced.result.researchStatus,
      outcome: traced.result.outcome,
      semanticValidation: "not_run",
    });
    if (scenario === "cached") {
      const reads = spans.filter(
        (span) => span.entityId === "readPage" && span.spanType === "tool_call",
      );
      expect(reads).toHaveLength(2);
      expect(
        reads.map((span) => JSON.parse(span.output as string).cached).sort(),
      ).toEqual([false, true]);
      expect(traced.result.budget.pages).toBe(2);
      expect(traced.requests).toBe(2);
    }
    if (scenario === "truncated" || scenario === "tool_truncated") {
      const read = spans.find(
        (span) => span.entityId === "readPage" && span.spanType === "tool_call",
      )!;
      expect(JSON.parse(read.output as string)).toMatchObject({
        status: "ok",
        truncated: true,
      });
      expect(traced.result.budget.pages).toBe(2);
      expect(traced.requests).toBe(4);
    }
    if (
      scenario === "partial" ||
      scenario === "mistaken" ||
      scenario === "recovered"
    ) {
      expect(output).toMatchObject({
        structuralValidation: "passed",
        targetValidation: "passed",
        editions: {
          context: { entries: [{ editionKey: "2026", year: 2026 }] },
          committed: {
            entries: [{ editionKey: "2023", year: 2027, role: "created" }],
          },
        },
      });
      expect(root.name).toContain("created:2027");
      expect(root.name).toContain("ctx:2026");
      expect(root.name).not.toContain("Model name mismatch");
      if (scenario === "partial") {
        expect(root.name).toContain("partial");
        expect(JSON.parse(root.metadata as string).promptVersion).toBe(
          RESEARCH_PROMPT_VERSION,
        );
        const locationSpan = spans.find(
          (span) => span.name === "resolve-location",
        )!;
        expect(JSON.parse(locationSpan.metadata as string).promptVersion).toBe(
          LOCATION_PROMPT_VERSION,
        );
      }
      if (scenario === "recovered") {
        expect(
          spans.some((span) =>
            String(span.output).includes("oversized_response"),
          ),
        ).toBe(true);
      }
    }
    if (scenario === "mistaken") {
    }
    if (scenario === "target") {
      expect(output).toMatchObject({
        structuralValidation: "passed",
        targetValidation: "failed",
      });
    }
    if (scenario === "skipped") {
      expect(output).toMatchObject({
        outcome: "skipped",
      });
    }
    if (scenario === "invalid") {
      expect(output).toMatchObject({
        structuralValidation: "failed",
        targetValidation: "not_run",
        errorCode: "validation_failed",
      });
    }
    if (scenario === "invalid_editor" || scenario === "rejected_editor") {
      const rejected = scenario === "rejected_editor";
      expect(output).toMatchObject({
        researchStatus: rejected ? "partial" : "success",
        editorStatus: rejected ? "success" : "failed",
        outcome: "failed",
        structuralValidation: "passed",
        targetValidation: "passed",
        editorPlanValidation: "failed",
        errorCode: rejected ? "editor_rejected" : "validation_failed",
      });
      expect(traced.result).toMatchObject({
        operations: [],
        changes: [],
        receipts: [],
      });
      expect(root.name).toContain(rejected ? "editor-rejected" : "invalid");
      if (rejected) {
        expect(root.name).not.toContain("partial");
      }
    }
    if (scenario === "search" || scenario === "reserved") {
      const search = spans.find((span) => span.entityId === "searchWeb")!;
      expect(JSON.parse(search.input as string).query).toContain(
        TRACE_PUBLIC_URL,
      );
      expect(JSON.parse(search.output as string)).toMatchObject({
        status: "ok",
        returnedCount: 1,
      });
    }
  },
);

test("dry-run with tracing enabled creates a store and retains its durable preview", async () => {
  const path = tracePath();
  enable(path);
  const { result, effects, durableReport } = await runTraceFixture(
    "success",
    false,
    "partial",
    true,
  );
  expect(existsSync(path)).toBe(true);
  expect(durableReport).toEqual(result);
  expect(effects).toHaveLength(1);
  expect(result.receipts.some((receipt) => receipt.changed)).toBe(true);
});

test.each(["context", "report", "no_report", "writer"] as const)(
  "%s failures finalize the trace without changing workflow failure behavior",
  async (failure) => {
    const contextModule = await import("../../research/context");
    const reportModule = await import("../../report");
    const writerModule = await import("@/catalog/write/apply-operation");
    const path = tracePath();
    enable(path);
    vi.stubEnv("CATALOG_LOGGING", "true");
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    if (failure === "context") {
      vi.spyOn(contextModule, "loadResearchContext").mockImplementation(() => {
        throw new Error(TRACE_ERROR);
      });
    }
    if (failure === "report" || failure === "no_report") {
      vi.spyOn(reportModule, "buildResearchReport").mockImplementation(() => {
        throw new Error(TRACE_ERROR);
      });
    }
    if (failure === "no_report") {
      vi.spyOn(reportModule, "buildWorkflowFailureReport").mockImplementation(
        () => {
          throw new Error(TRACE_ERROR);
        },
      );
    }
    if (failure === "writer") {
      vi.spyOn(writerModule, "applyCatalogItem").mockImplementation(() => {
        throw new Error(TRACE_ERROR);
      });
    }
    if (failure === "no_report") {
      await expect(
        runTraceFixture("success", false, "partial"),
      ).rejects.toThrow(TRACE_ERROR);
    } else {
      await runTraceFixture("success", false, "partial");
    }
    const saved = await readTraceRows(path);
    const root = saved.mastra_ai_spans.find((span) => !span.parentSpanId)!;
    const output = JSON.parse(root.output as string);
    expect(root.endedAt).toBeTruthy();
    expect(JSON.parse(root.error as string)).toMatchObject({
      message: "operation_failed",
    });
    expect(output).toMatchObject({
      errorCode:
        failure === "context"
          ? "context_failed"
          : failure === "writer"
            ? "write_failed"
            : "report_failed",
    });
    if (failure === "no_report") {
      expect(output).not.toHaveProperty("researchStatus");
    }
  },
);

test("thrown discovery retains safe query and a fixed code", async () => {
  const path = tracePath();
  enable(path);
  await runTraceFixture("success", false, "search_failure");
  const search = (await spansAt(path)).find(
    (span) => span.entityId === "searchWeb",
  )!;
  expect(JSON.parse(search.output as string)).toMatchObject({
    status: "failed",
    errorCode: "search_failed",
  });
});
