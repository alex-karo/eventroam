import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { LOCATION_PROMPT_VERSION } from "../../location/contracts";
import { PROMPT_VERSIONS } from "../../roles/versions";
import {
  readTraceRows,
  runTraceFixture as executeTraceFixture,
  TRACE_ERROR,
  TRACE_CANDIDATE,
  TRACE_SOURCE_BODY,
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
  expect(rows.mastra_logs).toEqual([]);
  return spans;
}

test("offline real agent persists native model/tool relationships and run metadata", async () => {
  const path = tracePath();
  enable(path);
  const result = await runTraceFixture();
  expect(result.requests).toBe(4);
  expect(result.result).toMatchObject({
    researchStatus: "success",
  });
  expect(result.durableReport).toEqual(result.result);
  expect(JSON.stringify(result.result.modelResponse)).toContain(
    TRACE_CANDIDATE,
  );
  const spans = await spansAt(path);
  expect(JSON.stringify(spans)).toContain(TRACE_CANDIDATE);
  expect(JSON.stringify(spans)).toContain(TRACE_SOURCE_BODY);
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
  expect(root.name).toBe("catalog-research");
  expect(JSON.parse(root.output as string)).toMatchObject({
    researchStatus: "success",
  });
  expect(JSON.parse(root.metadata as string).runId).toBe(result.result.runId);
  const reads = spans.filter((span) => span.entityId === "inspectPage");
  expect(reads).toHaveLength(1);
  for (const read of reads) {
    const output = JSON.parse(read.output as string);
    expect(output).toHaveProperty("retrieval", "ok");
    expect(output).toHaveProperty("overview");
    expect(output).not.toHaveProperty("markdown");
    expect(output).not.toHaveProperty("evidenceIds");
  }
  expect(
    reads.some((span) => JSON.stringify(span).includes(TRACE_PUBLIC_URL)),
  ).toBe(true);
  expect(spans.every((span) => span.endedAt)).toBe(true);
});

test.each(["http", "abort"] as const)(
  "%s retains final spans, original errors, partial usage and no retry",
  async (ending) => {
    const path = tracePath();
    enable(path);
    const { result, requests } = await runTraceFixture(ending);
    expect(requests).toBe(3);
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
    expect(tokens).toMatchObject({ value: 10, runId: result.runId });
    expect(JSON.parse(root.error as string)).toMatchObject({
      message: expect.any(String),
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
      errors: expect.arrayContaining([
        expect.objectContaining(
          ending === "http"
            ? {
                code: "model_failed",
                diagnostic: expect.objectContaining({ httpStatus: 503 }),
              }
            : { code: "limit_reached" },
        ),
      ]),
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
  expect(result.researchStatus).toBe("success");
  expect(requests).toBe(4);
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
    expect(requests).toBe(ending === "success" ? 4 : 3);
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
  expect(JSON.parse(writer.stdout).result.researchStatus).toBe("success");
  expect(JSON.parse(writer.stdout).durationMs).toBeLessThan(5_000);
  expect(writer.stderr).toBe("");
  const reader = await execute(
    process.execPath,
    ["--import", "tsx", script, "read"],
    { env },
  );
  expect(JSON.parse(reader.stdout)).toBeTruthy();
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
  "%s apply fixture persists native traces and its durable report",
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
    expect(root.name).toBe("catalog-research");
    expect(output).toEqual({
      researchStatus: traced.result.researchStatus,
      editorStatus: traced.result.editorStatus,
      locationStatus: traced.result.locationStatus,
      outcome: traced.result.outcome,
    });
    if (scenario === "cached") {
      const reads = spans.filter(
        (span) =>
          span.entityId === "inspectPage" && span.spanType === "tool_call",
      );
      expect(reads).toHaveLength(2);
      expect(JSON.parse(reads[0].output as string).sourceId).toBe(
        JSON.parse(reads[1].output as string).sourceId,
      );
      expect(traced.result.budget.pages).toBe(2);
      expect(traced.requests).toBe(4);
      expect(
        spans.filter(
          (span) =>
            span.entityId === "festival-reader" &&
            span.spanType === "agent_run",
        ),
      ).toHaveLength(1);
    }
    if (scenario === "truncated" || scenario === "tool_truncated") {
      const read = spans.find(
        (span) =>
          span.entityId === "inspectPage" && span.spanType === "tool_call",
      )!;
      expect(JSON.parse(read.output as string)).toMatchObject({
        retrieval: "ok",
        processing: "complete",
      });
      expect(JSON.parse(read.output as string)).not.toHaveProperty("markdown");
      const reader = spans.find(
        (span) =>
          span.entityId === "festival-reader" && span.spanType === "agent_run",
      )!;
      expect(String(reader.input).length).toBeGreaterThan(80_000);
      expect(traced.result.budget.pages).toBe(2);
    }
    if (scenario === "partial") {
      expect(JSON.parse(root.metadata as string).promptVersion).toBe(
        PROMPT_VERSIONS.research,
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
        traced.result.sources.some(
          (source) => source.reason === "oversized_response",
        ),
      ).toBe(true);
    }
    if (scenario === "skipped") {
      expect(output).toMatchObject({
        outcome: "skipped",
      });
    }
    if (scenario === "invalid_editor" || scenario === "rejected_editor") {
      const rejected = scenario === "rejected_editor";
      expect(output).toMatchObject({
        researchStatus: rejected ? "partial" : "success",
        editorStatus: rejected ? "success" : "failed",
        outcome: "failed",
      });
      expect(traced.result).toMatchObject({
        operations: [],
        changes: [],
        receipts: [],
      });
    }
    if (scenario === "search" || scenario === "reserved") {
      const search = spans.find((span) => span.entityId === "searchWeb")!;
      expect(JSON.parse(search.input as string).query).toContain(
        TRACE_PUBLIC_URL,
      );
      expect(JSON.parse(search.output as string).candidates).toHaveLength(1);
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
    const output = root.output ? JSON.parse(root.output as string) : {};
    expect(root.endedAt).toBeTruthy();
    expect(JSON.parse(root.error as string)).toMatchObject({
      message: expect.any(String),
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
  expect(search.error).toBeTruthy();
});
