import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { SpanType } from "@mastra/core/observability";
import {
  createRunObservability,
  finishRunObservability,
} from "../observability/runtime";
import {
  readTraceRows,
  runTraceFixture,
  TRACE_CANDIDATE,
  TRACE_CREDENTIAL,
  TRACE_SOURCE_BODY,
  TRACE_TRANSPORT,
} from "@/test/tracing-fixture";
import { shrinkText } from "./text";

const dirs: string[] = [];
function database() {
  const dir = mkdtempSync(join(tmpdir(), "pino-logging-test-"));
  dirs.push(dir);
  return join(dir, "observability.duckdb");
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});
function enable(file: string, tracing: boolean) {
  vi.stubEnv("CATALOG_LOGGING", "true");
  vi.stubEnv("CATALOG_TRACING", String(tracing));
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", file);
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
}
const input = {
  mode: "add" as const,
  name: "Fixture",
  actor: "test",
  dryRun: false,
};

test("Mastra uses Pino for SDK diagnostics without exporting them to Studio", async () => {
  const file = database();
  enable(file, false);
  const run = (await createRunObservability(input, "fixture", "sdk-pino"))!;
  run.mastra.getLogger().info("SDK diagnostic", { component: "fixture" });
  run.log!.info("Application event", { stage: "research" });
  await finishRunObservability(run);

  const lines = vi
    .mocked(process.stderr.write)
    .mock.calls.map(([chunk]) => String(chunk));
  const diagnostic = lines.find((line) =>
    line.includes('"msg":"SDK diagnostic"'),
  )!;
  expect(JSON.parse(diagnostic)).toMatchObject({
    runId: "sdk-pino",
    component: "fixture",
  });
  const rows = readTraceRows(file).mastra_logs;
  expect(rows).toHaveLength(1);
  expect(rows[0].message).toBe("Application event");
});

test("Pino children persist selected context, severity and trace correlation in Studio logs", async () => {
  const file = database();
  enable(file, true);
  const run = (await createRunObservability(input, "fixture", "run-pino"))!;
  const span = run.root!.createChildSpan({
    type: SpanType.GENERIC,
    name: "source",
  });
  const source = run.log!.child({
    stage: "source",
    toolCallId: "call-1",
    traceId: span.traceId,
    spanId: span.id,
  });
  source.info("Source fetched", {
    runId: "ignored-override",
    sourceCharacters: 42,
    response: { status: 200, url: "https://example.org" },
  });
  source.warn("Source incomplete", { reason: "short" });
  span.end();
  await finishRunObservability(run);

  const nativeLine = vi
    .mocked(process.stderr.write)
    .mock.calls.map(([chunk]) => String(chunk))
    .find((line) => line.includes('"msg":"Source fetched"'))!;
  expect(JSON.parse(nativeLine)).toMatchObject({
    runId: "run-pino",
    stage: "source",
    traceId: span.traceId,
    spanId: span.id,
    sourceCharacters: 42,
  });
  for (const key of ["runId", "stage", "traceId", "spanId"]) {
    expect(nativeLine.match(new RegExp(`"${key}":`, "g"))).toHaveLength(1);
  }

  const rows = readTraceRows(file).mastra_logs;
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.message === "Source fetched")).toMatchObject({
    message: "Source fetched",
    level: "info",
    runId: "run-pino",
    traceId: span.traceId,
    spanId: span.id,
    data: {
      runId: "run-pino",
      stage: "source",
      toolCallId: "call-1",
      sourceCharacters: 42,
      response: { status: 200, url: "https://example.org" },
    },
  });
  expect(rows.find((row) => row.message === "Source incomplete")).toMatchObject(
    {
      level: "warn",
      data: { stage: "source", reason: "short" },
    },
  );
  expect(JSON.stringify(rows)).not.toContain("catalogApplicationLog");
});

test.each([undefined, "known-event"])(
  "event context follows resolved identity (initial: %s)",
  async (eventId) => {
    const file = database();
    enable(file, false);
    const run = (await createRunObservability(
      { ...input, eventId },
      "fixture",
      "event-context",
    ))!;
    const child = run.log!.child({ stage: "source" });
    child.info("Before resolution");
    run.mastra.getLogger().info("SDK before resolution");
    run.setEventId("resolved-event");
    child.info("After resolution");
    run.mastra.getLogger().info("SDK after resolution");
    await finishRunObservability(run);
    const rows = readTraceRows(file).mastra_logs;
    expect(
      (
        rows.find((row) => row.message === "Before resolution")?.data as Record<
          string,
          unknown
        >
      )?.eventId,
    ).toBe(eventId);
    expect(
      (
        rows.find((row) => row.message === "After resolution")?.data as Record<
          string,
          unknown
        >
      )?.eventId,
    ).toBe("resolved-event");
    const lines = vi
      .mocked(process.stderr.write)
      .mock.calls.map(([chunk]) => String(chunk));
    expect(
      JSON.parse(
        lines.find((line) => line.includes('"msg":"SDK before resolution"'))!,
      ).eventId,
    ).toBe(eventId);
    expect(
      JSON.parse(
        lines.find((line) => line.includes('"msg":"SDK after resolution"'))!,
      ).eventId,
    ).toBe("resolved-event");
  },
);

test("level filtering and logging-only mode produce untraced records", async () => {
  const file = database();
  enable(file, false);
  vi.stubEnv("CATALOG_LOG_LEVEL", "warn");
  const run = (await createRunObservability(input, "fixture", "only-logs"))!;
  run.log!.debug("Filtered debug", { value: 1 });
  run.log!.info("Filtered info", { value: 2 });
  run.log!.warn("Retained warn", { value: 3 });
  await finishRunObservability(run);
  const rows = readTraceRows(file);
  expect(rows.mastra_ai_spans).toHaveLength(0);
  expect(rows.mastra_logs).toHaveLength(1);
  expect(rows.mastra_logs[0]).toMatchObject({
    level: "warn",
    runId: "only-logs",
    data: { value: 3 },
  });
});

test("unexpected logger payload getter failures do not interrupt ingestion", async () => {
  const file = database();
  enable(file, false);
  const run = (await createRunObservability(input, "fixture", "fail-open"))!;
  const fields = {
    get value(): never {
      throw new Error("payload failed");
    },
  };
  expect(() => run.log!.info("Broken event", fields)).not.toThrow();
  run.log!.info("Following event", { ok: true });
  await finishRunObservability(run);
  const rows = readTraceRows(file).mastra_logs;
  expect(rows).toHaveLength(1);
  expect(rows[0].message).toBe("Following event");
});

test("explicit model text shortening respects Unicode code points", () => {
  expect(shrinkText("😀".repeat(4_001))).toBe("😀".repeat(4_000));
  expect(shrinkText("abc", 2)).toBe("ab");
});

test("real research stores selected completed model text without source bodies or prompts", async () => {
  const file = database();
  enable(file, true);
  const result = await runTraceFixture("success", false, "partial", false, {
    commentary: "C".repeat(4_100),
    reasoning: "R".repeat(4_200),
  });
  const rows = readTraceRows(file);
  expect(
    rows.mastra_logs.some((row) => row.runId === result.result.runId),
  ).toBe(true);
  expect(result.durableReport).toMatchObject({ runId: result.result.runId });
  for (const row of rows.mastra_logs) {
    expect(row.data).toMatchObject({ eventId: result.result.eventId });
  }
  expect(
    rows.mastra_logs.some((row) => row.message === "Tool call finished"),
  ).toBe(true);
  const commentary = rows.mastra_logs.find(
    (row) =>
      row.message === "Model commentary observed at step completion" &&
      (row.data as Record<string, unknown>)?.originalCharacters === 4_100,
  );
  const reasoning = rows.mastra_logs.find(
    (row) =>
      row.message === "Provider reasoning observed at step completion" &&
      (row.data as Record<string, unknown>)?.originalCharacters === 4_200,
  );
  expect(
    rows.mastra_logs.filter(
      (row) => row.message === "Model commentary observed at step completion",
    ),
  ).toHaveLength(1);
  expect(commentary?.data).toMatchObject({
    text: "C".repeat(4_000),
    originalCharacters: 4_100,
    truncated: true,
    channel: "commentary",
  });
  expect(reasoning?.data).toMatchObject({
    text: "R".repeat(4_000),
    originalCharacters: 4_200,
    truncated: true,
    channel: "reasoning",
  });
  const stored = JSON.stringify(rows);
  for (const secret of [
    TRACE_CANDIDATE,
    TRACE_CREDENTIAL,
    TRACE_SOURCE_BODY,
    TRACE_TRANSPORT,
  ]) {
    expect(stored).not.toContain(secret);
  }
  expect(
    rows.mastra_logs.some((row) => row.message === "Research finished"),
  ).toBe(true);
});

test("finalization failure logs the already committed catalog write", async () => {
  const runs = await import("../../runs");
  const file = database();
  enable(file, true);
  vi.spyOn(runs, "finalizeIngestionRun").mockImplementation(
    (_client, runId, report) => {
      throw new runs.RunPersistenceError(runId, report);
    },
  );
  await expect(runTraceFixture("success", false, "partial")).rejects.toThrow(
    runs.RunPersistenceError,
  );
  const rows = readTraceRows(file).mastra_logs;
  const committed = rows.find(
    (row) => row.message === "Catalog write finished",
  );
  const failed = rows.find(
    (row) => row.message === "Required run finalization failed",
  );
  expect(committed?.data).toMatchObject({ writeState: "committed" });
  expect(
    (committed?.data as Record<string, unknown>).committedOperationCount,
  ).toBeGreaterThan(0);
  expect(failed).toMatchObject({
    runId: committed?.runId,
    level: "error",
    data: {
      writeState: "committed",
      errorCode: "run_persistence_failed",
    },
  });
  expect(
    (failed?.data as Record<string, unknown>).committedOperationCount,
  ).toBeGreaterThan(0);
});

test("enabled application logging excludes unmarked SDK logs", async () => {
  const file = database();
  enable(file, true);
  const run = (await createRunObservability(input, "fixture", "sdk-filter"))!;
  run.observability.getDefaultInstance()!.getLoggerContext!(run.root!).info(
    "PRIVATE_SDK_MESSAGE",
    { body: "PRIVATE_SDK_BODY" },
  );
  run.log!.info("Selected application event", { stage: "research" });
  await finishRunObservability(run);
  const rows = readTraceRows(file).mastra_logs;
  expect(rows).toHaveLength(1);
  expect(rows[0].message).toBe("Selected application event");
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_SDK");
});

test("native Pino delivery failure does not prevent Studio delivery", async () => {
  const { PinoLogger } = await import("@mastra/loggers");
  const file = database();
  enable(file, false);
  const run = (await createRunObservability(
    input,
    "fixture",
    "native-failure",
  ))!;
  vi.spyOn(PinoLogger.prototype, "info").mockImplementation(() => {
    throw new Error("PRIVATE_NATIVE_FAILURE");
  });
  expect(() =>
    run.log!.info("Still persisted", { stage: "research" }),
  ).not.toThrow();
  await finishRunObservability(run);
  expect(readTraceRows(file).mastra_logs[0]).toMatchObject({
    message: "Still persisted",
    runId: "native-failure",
  });
  expect(
    vi
      .mocked(process.stderr.write)
      .mock.calls.map(([value]) => String(value))
      .join(""),
  ).not.toContain("PRIVATE_NATIVE_FAILURE");
});

test.each([
  [false, "partial"],
  [false, "search"],
  [true, "partial"],
  [true, "search"],
] as const)(
  "agent tools omit no-op correlation (dryRun=%s, scenario=%s)",
  async (dryRun, scenario) => {
    const file = database();
    enable(file, dryRun);
    const result = await runTraceFixture("success", false, scenario, dryRun);
    const rows = readTraceRows(file);
    expect(rows.mastra_ai_spans).toHaveLength(0);
    const toolLogs = rows.mastra_logs.filter(
      (row) =>
        typeof row.message === "string" && row.message.startsWith("Tool call"),
    );
    expect(toolLogs.length).toBeGreaterThan(0);
    for (const row of toolLogs) {
      expect(row.runId).toBe(result.result.runId);
      expect(row.traceId ?? null).toBeNull();
      expect(row.spanId ?? null).toBeNull();
      expect(row.data).not.toHaveProperty("traceId");
      expect(row.data).not.toHaveProperty("spanId");
    }
    expect(JSON.stringify(rows)).not.toContain("no-op");
  },
);
