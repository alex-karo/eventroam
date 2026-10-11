import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import {
  readTraceRows,
  runTraceFixture,
  TRACE_ERROR,
  TRACE_CREDENTIAL,
  TRACE_SOURCE_BODY,
  TRACE_CANDIDATE,
  TRACE_TRANSPORT,
  TRACE_PUBLIC_MARKER,
  TRACE_PUBLIC_URL,
} from "@/test/tracing-fixture";
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
function spansAt(path: string) {
  const rows = readTraceRows(path);
  const spans = rows.mastra_ai_spans as Record<string, unknown>[];
  expect(spans.length).toBeGreaterThan(0);
  for (const marker of [
    TRACE_ERROR,
    TRACE_CREDENTIAL,
    TRACE_SOURCE_BODY,
    TRACE_CANDIDATE,
    TRACE_TRANSPORT,
  ]) {
    expect(JSON.stringify(rows)).not.toContain(marker);
  }
  expect(
    Object.keys(rows)
      .filter((name) => name.includes("log"))
      .flatMap((name) => rows[name]),
  ).toEqual([]);
  return spans;
}

test("offline real agent persists sanitized model/tool relationships and bounded metadata", async () => {
  const path = tracePath();
  enable(path);
  const result = await runTraceFixture();
  expect(result.requests).toBe(2);
  expect(result.result).toMatchObject({
    researchStatus: "failed",
    usage: { complete: true, inputTokens: 20, outputTokens: 40 },
  });
  expect(result.durableReport).toEqual(result.result);
  expect(JSON.stringify(result.result.modelResponse)).toContain(
    TRACE_CANDIDATE,
  );
  const spans = spansAt(path);
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
    writeState: "not_attempted",
    semanticValidation: "not_run",
    committedOperationCount: 0,
  });
  expect(JSON.parse(root.metadata as string).runId).toBe(result.result.runId);
  const reads = spans.filter((span) => span.entityId === "readSource");
  expect(reads).toHaveLength(2);
  expect(
    reads.some((span) => JSON.stringify(span).includes(TRACE_PUBLIC_URL)),
  ).toBe(true);
  expect(
    reads.some(
      (span) => JSON.parse(span.output as string).reason === "request_failed",
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
    expect(result).toMatchObject({
      usage: { complete: false, inputTokens: 10, outputTokens: 20 },
    });
    const root = spansAt(path).find((span) => !span.parentSpanId)!;
    expect(JSON.parse(root.error as string)).toMatchObject({
      message: "operation_failed",
    });
    expect(JSON.parse(root.output as string)).toMatchObject({
      researchStatus: "failed",
      writeState: "not_attempted",
      committedOperationCount: 0,
    });
  },
);

test.each([false, true])(
  "disabled/injected real agent path %s creates no store",
  async (injected) => {
    const path = tracePath();
    enable(path);
    if (!injected) {
      vi.stubEnv("CATALOG_TRACING", "false");
    }
    await runTraceFixture("success", injected);
    expect(existsSync(path)).toBe(false);
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
      usage: { complete: false, inputTokens: 10, outputTokens: 20 },
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
  "cleanup failures do not replace %s result or partial usage",
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
    expect(result.usage).toMatchObject({
      complete: ending === "success",
      inputTokens: ending === "success" ? 20 : 10,
    });
    const codes = stderr.mock.calls.map((call) => call[0]).join("");
    expect(codes).toContain("trace_flush_failed\n");
    expect(codes).toContain("trace_shutdown_failed\n");
    expect(codes).not.toContain(TRACE_ERROR);
  },
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
    TRACE_CANDIDATE,
    TRACE_TRANSPORT,
  ]) {
    expect(reader.stdout).not.toContain(marker);
  }
  spansAt(path);
}, 15_000);

function normalize(
  result: Awaited<ReturnType<typeof runTraceFixture>>["result"],
) {
  const copy = structuredClone(result);
  delete copy.runId;
  copy.durationMs = 0;
  for (const change of copy.changes) {
    if (change.field === "created_at" || change.field === "updated_at") {
      change.newValue = "TIMESTAMP";
    }
  }
  copy.usage.elapsedMs = 0;
  copy.usage.remaining.durationMs = 0;
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
  "unchanged",
  "search",
  "reserved",
  "target",
  "skipped",
] as const)(
  "%s apply fixture preserves decisions, report contract and catalog effects with tracing on/off",
  async (scenario) => {
    vi.stubEnv("CATALOG_TRACING", "false");
    const baseline = await runTraceFixture("success", false, scenario);
    const path = tracePath();
    enable(path);
    const traced = await runTraceFixture("success", false, scenario);
    expect(normalize(traced.result)).toEqual(normalize(baseline.result));
    expect(traced.effects).toEqual(baseline.effects);
    expect(traced.requests).toBe(baseline.requests);
    expect(traced.durableReport).toEqual(traced.result);
    const spans = spansAt(path);
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
        (span) =>
          span.entityId === "readSource" && span.spanType === "tool_call",
      );
      expect(reads).toHaveLength(2);
      expect(
        reads.map((span) => JSON.parse(span.output as string).cached).sort(),
      ).toEqual([false, true]);
      expect(traced.result.usage.pages).toBe(2);
      expect(traced.requests).toBe(2);
    }
    if (scenario === "truncated" || scenario === "tool_truncated") {
      const read = spans.find(
        (span) =>
          span.entityId === "readSource" && span.spanType === "tool_call",
      )!;
      expect(JSON.parse(read.output as string)).toMatchObject({
        sourceTruncated: scenario === "truncated",
        toolTruncated: scenario === "tool_truncated",
        ...(scenario === "truncated"
          ? { reason: "source_content_truncated", completeness: "partial" }
          : {}),
      });
      expect(traced.result.usage.pages).toBe(2);
      expect(traced.requests).toBe(2);
    }
    if (
      scenario === "partial" ||
      scenario === "mistaken" ||
      scenario === "recovered"
    ) {
      expect(output).toMatchObject({
        structuralValidation: "passed",
        targetValidation: "passed",
        writeState: "committed",
        editions: {
          context: { entries: [{ editionKey: "2026", year: 2026 }] },
          committed: {
            entries: [{ editionKey: "2023", year: 2023, role: "created" }],
          },
        },
      });
      expect(root.name).toContain("created:2023");
      expect(root.name).toContain("ctx:2026");
      expect(root.name).not.toContain("Model name mismatch");
      if (scenario === "partial") {
        expect(root.name).toContain("partial");
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
      expect(traced.result.usage).toMatchObject({
        complete: false,
        modelCostUsd: null,
      });
    }
    if (scenario === "target") {
      expect(output).toMatchObject({
        structuralValidation: "passed",
        targetValidation: "failed",
        writeState: "not_attempted",
      });
    }
    if (scenario === "skipped") {
      expect(output).toMatchObject({
        outcome: "skipped",
        writeState: "unchanged",
        committedOperationCount: 0,
      });
    }
    if (scenario === "invalid") {
      expect(output).toMatchObject({
        structuralValidation: "failed",
        targetValidation: "not_run",
        writeState: "not_attempted",
        errorCode: "validation_failed",
        committedOperationCount: 0,
      });
    }
    if (scenario === "unchanged") {
      expect(output.writeState).toBe("unchanged");
    }
    if (scenario === "search" || scenario === "reserved") {
      const search = spans.find((span) => span.entityId === "discoverSources")!;
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

test("dry-run with tracing enabled creates no store and retains its durable preview", async () => {
  const path = tracePath();
  enable(path);
  const { result, effects, durableReport } = await runTraceFixture(
    "success",
    false,
    "partial",
    true,
  );
  expect(existsSync(path)).toBe(false);
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
    const root = spansAt(path).find((span) => !span.parentSpanId)!;
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
      writeState:
        failure === "context"
          ? "not_attempted"
          : failure === "writer"
            ? "rolled_back"
            : "committed",
    });
    if (failure === "report" || failure === "no_report") {
      expect(output.committedOperationCount).toBeGreaterThan(0);
    } else {
      expect(output.committedOperationCount).toBe(0);
    }
    if (failure === "no_report") {
      expect(output).not.toHaveProperty("researchStatus");
    }
  },
);

test("thrown discovery retains safe query and a fixed code", async () => {
  const path = tracePath();
  enable(path);
  await runTraceFixture("success", false, "search_failure");
  const search = spansAt(path).find(
    (span) => span.entityId === "discoverSources",
  )!;
  expect(JSON.parse(search.output as string)).toMatchObject({
    status: "failed",
    errorCode: "search_failed",
  });
});
