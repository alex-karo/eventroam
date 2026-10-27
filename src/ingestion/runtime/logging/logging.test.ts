import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { SpanType } from "@mastra/core/observability";
import {
  createRunObservability,
  finishRunObservability,
} from "../observability/runtime";
import { readTraceRows, runTraceFixture } from "@/test/tracing-fixture";
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

test("Mastra exports SDK and application logs through native Pino", async () => {
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
    component: "fixture",
  });
  const rows = (await readTraceRows(file)).mastra_logs;
  expect(rows.map((row) => row.message)).toEqual(
    expect.arrayContaining(["Application event", "SDK diagnostic"]),
  );
  expect(
    rows.filter((row) => row.message === "Application event"),
  ).toHaveLength(1);
  expect(
    rows.find((row) => row.message === "Application event")?.data,
  ).toMatchObject({ runId: "sdk-pino", stage: "research" });
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

  const rows = (await readTraceRows(file)).mastra_logs;
  expect(rows.find((row) => row.message === "Source fetched")).toMatchObject({
    message: "Source fetched",
    level: "info",
    data: {
      traceId: span.traceId,
      spanId: span.id,
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
    const rows = (await readTraceRows(file)).mastra_logs;
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
  const rows = await readTraceRows(file);
  expect(rows.mastra_ai_spans).toHaveLength(0);
  expect(rows.mastra_logs).toHaveLength(1);
  expect(rows.mastra_logs[0]).toMatchObject({
    level: "warn",
    data: { runId: "only-logs", value: 3 },
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
  const rows = (await readTraceRows(file)).mastra_logs;
  expect(rows.some((row) => row.message === "Broken event")).toBe(false);
  expect(rows.some((row) => row.message === "Following event")).toBe(true);
});

test("explicit model text shortening respects Unicode code points", () => {
  expect(shrinkText("😀".repeat(4_001))).toBe("😀".repeat(4_000));
  expect(shrinkText("abc", 2)).toBe("ab");
});

test.each([
  ["rejected_editor", "editor_rejected"],
  ["invalid_editor", "invalid_plan"],
] as const)(
  "%s logs rejection rather than a prepared plan",
  async (scenario, code) => {
    const file = database();
    enable(file, true);
    await runTraceFixture("success", false, scenario);
    const rows = await readTraceRows(file);
    expect(
      rows.mastra_logs.find((row) => row.message === "Editorial plan rejected"),
    ).toMatchObject({
      level: "warn",
      data: {
        operationCount: 0,
        validation: {
          structural: "passed",
          target: "passed",
        },
        errors: expect.arrayContaining([expect.objectContaining({ code })]),
      },
    });
    expect(
      rows.mastra_logs.some((row) => row.message === "Editorial plan prepared"),
    ).toBe(false);
  },
);

test("real research retains selected model/tool logs", async () => {
  const file = database();
  enable(file, true);
  const result = await runTraceFixture("success", false, "partial", false, {
    commentary: "C".repeat(4_100),
    reasoning: "R".repeat(4_200),
  });
  const rows = await readTraceRows(file);
  expect(
    rows.mastra_logs.some(
      (row) =>
        (row.data as Record<string, unknown>)?.runId === result.result.runId,
    ),
  ).toBe(true);
  expect(result.durableReport).toMatchObject({ runId: result.result.runId });

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
  expect(
    rows.mastra_logs.find((row) => row.message === "Research finished")?.data,
  ).toMatchObject({ durationMs: result.result.durationMs });
  expect(result.result.budget.modelCalls).toBe(4);
  expect(result.result.schemaVersion).toBe(7);
  expect(
    rows.mastra_logs.some((row) => row.message === "Research finished"),
  ).toBe(true);
});

test("enabled application logging accepts native SDK logs", async () => {
  const file = database();
  enable(file, true);
  const run = (await createRunObservability(input, "fixture", "sdk-filter"))!;
  run.observability.getDefaultInstance()!.getLoggerContext!(run.root!).info(
    "PRIVATE_SDK_MESSAGE",
    { body: "PRIVATE_SDK_BODY" },
  );
  run.log!.info("Selected application event", { stage: "research" });
  await finishRunObservability(run);
  const rows = (await readTraceRows(file)).mastra_logs;
  expect(rows.map((row) => row.message)).toEqual(
    expect.arrayContaining([
      "Selected application event",
      "PRIVATE_SDK_MESSAGE",
    ]),
  );
});

test("native Pino delivery failure remains optional", async () => {
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
    run.log!.info("Optional delivery", { stage: "research" }),
  ).not.toThrow();
  await finishRunObservability(run);
});

test.each([
  [false, "partial"],
  [false, "search"],
  [true, "partial"],
  [true, "search"],
] as const)(
  "agent tools use native correlation (dryRun=%s, scenario=%s)",
  async (dryRun, scenario) => {
    const file = database();
    enable(file, dryRun);
    const result = await runTraceFixture("success", false, scenario, dryRun);
    const rows = await readTraceRows(file);
    if (dryRun) {
      expect(rows.mastra_ai_spans.length).toBeGreaterThan(0);
    } else {
      expect(rows.mastra_ai_spans).toHaveLength(0);
    }
    const toolLogs = rows.mastra_logs.filter(
      (row) =>
        typeof row.message === "string" && row.message.startsWith("Tool call"),
    );
    expect(toolLogs.length).toBeGreaterThan(0);
    for (const row of toolLogs) {
      expect(row.data).toMatchObject({ runId: result.result.runId });
      if (dryRun) {
        expect(row.traceId).toBeTruthy();
        expect(row.spanId).toBeTruthy();
      }
      if (!dryRun) {
        expect(row.data).not.toHaveProperty("traceId");
        expect(row.data).not.toHaveProperty("spanId");
      }
    }
  },
);
