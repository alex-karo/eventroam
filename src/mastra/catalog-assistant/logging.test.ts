import { dirname, join } from "node:path";
import { noopObserve } from "@mastra/core/tools";
import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { assistantIngestionResult } from "@/test/assistant-ingestion";
import { testFixtures } from "@/test/fixtures";
import { createAssistantFixtureModel } from "@/test/assistant-model";
import { readTraceRows } from "@/test/read-observability";
import { createObservabilityStore } from "../../ingestion/runtime/observability/storage";
import { createCatalogAssistant } from ".";
import { createAssistantLogging } from "./logging";
import { createChatMemory, StudioMastra } from "./memory";
import { createQueryCatalogTool } from "./tools/query-catalog/tool";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function setupLogging(level: "debug" | "error") {
  const db = testDatabase();
  const id = testFixtures().event({
    canonicalName: "PRIVATE_SQL_AGENT_ROW",
  }).id;
  const file = join(dirname(db.path), "logs.duckdb");
  vi.stubEnv("DATABASE_PATH", db.path);
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", file);
  vi.stubEnv("CATALOG_LOGGING", "true");
  vi.stubEnv("CATALOG_LOG_LEVEL", level);
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const storage = await createObservabilityStore();
  await storage.init();
  const chat = await createChatMemory(join(dirname(db.path), "chat.sqlite"));
  const logging = createAssistantLogging()!;
  const assistant = createCatalogAssistant(
    {
      createRun: async () => ({
        runId: "engine-one",
        cancel: async () => {},
        start: async ({ inputData }) => ({
          status: "failed",
          error: {
            message: JSON.stringify({
              code: "run_persistence_failed",
              summary: assistantIngestionResult({
                engineRunId: "engine-one",
                ingestionRunId: "ingestion-one",
                dryRun: inputData.dryRun,
                persistenceStatus: "failed",
                eventId: id,
                savedEditionCount: 0,
                returnedEditionCount: 0,
                readCount: 0,
                changedCount: 1,
                errorCodes: ["run_persistence_failed"],
              }),
            }),
          },
        }),
      }),
    },
    chat.memory,
    createAssistantFixtureModel(),
    logging,
  );
  const mastra = new StudioMastra(
    {
      agents: { "catalog-assistant": assistant },
      storage,
      logger: logging.native,
      observability: logging.observability,
    },
    chat,
  );
  const query = createQueryCatalogTool(() => db.path, logging);
  return { id, file, stderr, logging, assistant, mastra, query };
}

test("assistant logs use both sinks with native execution context", async () => {
  const { id, file, stderr, logging, assistant, mastra, query } =
    await setupLogging("debug");
  try {
    const reply = await assistant.generate("select Events", {
      memory: { thread: "owner-chat", resource: "owner" },
    });
    expect(reply.text).toContain("PRIVATE_SQL_AGENT_ROW");
    // Native SDK logs can retain payloads in the private store.
    mastra.getLogger().debug("PRIVATE_SDK_PROMPT", { sql: "PRIVATE_SQL" });
    mastra.getLogger().warn("PRIVATE_SDK_WARNING", { rows: ["PRIVATE_SQL"] });
    mastra.getLogger().error("PRIVATE_SDK_ERROR", {
      error: new Error("PRIVATE_SDK_EXCEPTION"),
    });
    await assistant.generate(`preview ${id}`, {
      memory: { thread: "owner-chat", resource: "owner" },
    });
    const secret = "PRIVATE_SQL_PARAMETER_AND_RESULT";
    expect(
      await query.execute!(
        { sql: "SELECT ? AS private_value", parameters: [secret] },
        { observe: noopObserve },
      ),
    ).toMatchObject({ ok: true, rows: [[secret]] });
    expect(
      await query.execute!(
        { sql: "SELECT * FROM PRIVATE_SQL_ERROR" },
        { observe: noopObserve },
      ),
    ).toMatchObject({ ok: false, error: "query_rejected" });
    await query.execute!(
      { sql: "SELECT 1" },
      { observe: noopObserve, abortSignal: AbortSignal.abort() },
    );
    // A log failure must not change SQL output.
    vi.spyOn(logging.native, "info").mockImplementationOnce(() => {
      throw new Error("PRIVATE_LOG_ERROR");
    });
    expect(
      await query.execute!({ sql: "SELECT 2" }, { observe: noopObserve }),
    ).toMatchObject({ ok: true, rows: [[2]] });
    // A broken log bus must not prevent query execution.
    vi.spyOn(
      logging.observability,
      "getDefaultInstance",
    ).mockImplementationOnce(() => {
      throw new Error("PRIVATE_BUS_ERROR");
    });
    expect(
      await query.execute!({ sql: "SELECT 3" }, { observe: noopObserve }),
    ).toMatchObject({ ok: true, rows: [[3]] });
  } finally {
    await mastra.shutdown();
  }
  const { mastra_logs: rows, mastra_ai_spans: spans } =
    await readTraceRows(file);
  expect(spans).toHaveLength(0);
  const result = rows.find(
    (row) => row.message === "Assistant refresh result",
  )!;
  expect(result).toMatchObject({
    level: "error",
    entityId: "refresh_events",
    threadId: "owner-chat",
    data: {
      toolName: "refresh_events",
      eventId: id,
      engineRunId: "engine-one",
      ingestionRunId: "ingestion-one",
      changedCount: 1,
      persistenceStatus: "failed",
      errorCodes: ["run_persistence_failed"],
    },
  });
  expect(result.data).toMatchObject({ toolCallId: expect.any(String) });
  expect(
    rows.filter((row) => row.message === "Assistant tool completed"),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: "query_rejected",
          durationMs: expect.any(Number),
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ failedCount: 1 }),
      }),
    ]),
  );
  expect(rows.some((row) => row.message === "Assistant tool started")).toBe(
    true,
  );
  expect(
    rows.some(
      (row) =>
        row.level === "warn" &&
        (row.data as Record<string, unknown>).errorCode === "cancelled",
    ),
  ).toBe(true);
  expect(
    rows.some((row) => (row.data as Record<string, unknown>).rowCount === 1),
  ).toBe(true);
  const lines = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
  expect(lines).toContain('"msg":"Assistant refresh result"');
  expect(lines).toContain('"msg":"PRIVATE_SDK_WARNING"');
  for (const secret of ["PRIVATE_LOG_ERROR", "PRIVATE_BUS_ERROR"]) {
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(lines).not.toContain(secret);
  }
});

test("error level filters both log sinks", async () => {
  const { file, stderr, mastra, query } = await setupLogging("error");
  try {
    await query.execute!({ sql: "SELECT 1" }, { observe: noopObserve });
    await query.execute!(
      { sql: "SELECT 1" },
      { observe: noopObserve, abortSignal: AbortSignal.abort() },
    );
    await query.execute!(
      { sql: "SELECT * FROM missing_table" },
      { observe: noopObserve },
    );
  } finally {
    await mastra.shutdown();
  }
  const { mastra_logs: rows } = await readTraceRows(file);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.level === "error")).toBe(true);
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: "query_rejected" }),
      }),
    ]),
  );
  const lines = stderr.mock.calls.map(([chunk]) => JSON.parse(String(chunk)));
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((line) => line.level === 50)).toBe(true);
  expect(lines).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ errorCode: "query_rejected" }),
    ]),
  );
});

test("disabled or invalid logging keeps SQL available", async () => {
  const db = testDatabase();
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  for (const enabled of [false, true]) {
    vi.stubEnv("CATALOG_LOGGING", String(enabled));
    vi.stubEnv("CATALOG_LOG_LEVEL", "invalid");
    const logging = createAssistantLogging();
    expect(logging).toBeUndefined();
    const tool = createQueryCatalogTool(() => db.path, logging);
    expect(
      await tool.execute!({ sql: "SELECT 1" }, { observe: noopObserve }),
    ).toMatchObject({ ok: true, rows: [[1]] });
    if (!enabled) {
      expect(stderr).not.toHaveBeenCalled();
    }
  }
  expect(stderr.mock.calls.map(([chunk]) => String(chunk))).toEqual([
    "trace_initialization_failed\n",
  ]);
});
