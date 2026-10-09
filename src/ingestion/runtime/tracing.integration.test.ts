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
  TRACE_SENTINEL,
} from "@/test/tracing-fixture";
const execute = promisify(execFile);
const dirs: string[] = [];
function tracePath() {
  const dir = mkdtempSync(join(tmpdir(), "trace-integration-"));
  dirs.push(dir);
  return join(dir, "traces.sqlite");
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
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", path);
}
function spansAt(path: string) {
  const rows = readTraceRows(path);
  const spans = rows.mastra_ai_spans as Record<string, unknown>[];
  expect(spans.length).toBeGreaterThan(0);
  expect(JSON.stringify(rows)).not.toContain(TRACE_SENTINEL);
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
    ok: true,
    usage: { complete: true, inputTokens: 20, outputTokens: 40 },
  });
  expect(JSON.stringify(result.result.modelResponse)).toContain(TRACE_SENTINEL);
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
  expect(JSON.parse(root.metadata as string)).toEqual({
    mode: "refresh",
    eventId: "trace-fixture",
    model: "fixture/provider-model",
    promptVersion: "model-direct-v5",
  });
  expect(
    spans.find((span) => span.name === "readSource")?.parentSpanId,
  ).toBeTruthy();
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
    spansAt(path);
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
    expect(traced.result).toEqual(baseline.result);
    expect(traced.requests).toBe(baseline.requests);
    expect(traced.result).toMatchObject({
      ok: false,
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
  expect(result.ok).toBe(true);
  expect(requests).toBe(2);
  expect(stderr.mock.calls.flat().join("")).toBe(
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
        throw new Error(TRACE_SENTINEL);
      });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(Observability.prototype, "flush").mockRejectedValue(
      new Error(TRACE_SENTINEL),
    );
    const { result, requests } = await runTraceFixture(ending);
    expect(shutdown).toHaveBeenCalledOnce();
    expect(requests).toBe(2);
    expect(result.usage).toMatchObject({
      complete: ending === "success",
      inputTokens: ending === "success" ? 20 : 10,
    });
    const codes = stderr.mock.calls.flat().join("");
    expect(codes).toContain("trace_flush_failed\n");
    expect(codes).toContain("trace_shutdown_failed\n");
    expect(codes).not.toContain(TRACE_SENTINEL);
  },
);

test("short buffered writer exits and a different process can read its final spans", async () => {
  const path = tracePath();
  const env = {
    ...process.env,
    CATALOG_TRACING: "true",
    CATALOG_TRACE_DATABASE_PATH: path,
  };
  const script = resolve("src/test/tracing-fixture.ts");
  const writer = await execute(
    process.execPath,
    ["--import", "tsx", script, "write"],
    { env },
  );
  expect(JSON.parse(writer.stdout).result.ok).toBe(true);
  expect(JSON.parse(writer.stdout).durationMs).toBeLessThan(5_000);
  expect(writer.stderr).toBe("");
  const reader = await execute(
    process.execPath,
    ["--import", "tsx", script, "read"],
    { env },
  );
  expect(reader.stdout).not.toContain(TRACE_SENTINEL);
  spansAt(path);
}, 15_000);
