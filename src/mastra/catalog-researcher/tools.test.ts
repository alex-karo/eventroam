import { MessageList } from "@mastra/core/agent";
import { noopObserve } from "@mastra/core/tools";
import { RequestContext } from "@mastra/core/request-context";
import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { assistantExecutionContext } from "../catalog-assistant/execution-context";
import { createAddEventsTool } from "./tools/add-events";
import { createSearchWebTool } from "./tools/search-web";
import { createQueryCatalogTool } from "../catalog-assistant/tools/query-catalog/tool";
import { createCancelBatchTool } from "../catalog-assistant/tools/cancel-batch/tool";

function context() {
  const requestContext = new RequestContext();
  assistantExecutionContext.processInput({
    requestContext,
    messageList: new MessageList({ threadId: "owner" }),
  } as Parameters<typeof assistantExecutionContext.processInput>[0]);
  return { requestContext, observe: noopObserve };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test("add requires host context, shares one selection across parallel calls, and needs no search key", async () => {
  const db = testDatabase();
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const tool = createAddEventsTool(() => db.path);
  expect(
    await tool.execute!(
      { inputs: ["clue"], dryRun: true },
      { observe: noopObserve },
    ),
  ).toMatchObject({ error: "host_context_required" });
  const ctx = context();
  expect(
    await tool.execute!(
      { inputs: ["clue"], dryRun: true },
      { ...ctx, abortSignal: AbortSignal.abort() },
    ),
  ).toMatchObject({ error: "cancelled" });
  const results = await Promise.all([
    tool.execute!({ inputs: ["alpha", "beta"], dryRun: false }, ctx),
    tool.execute!({ inputs: ["again"], dryRun: true }, ctx),
  ]);
  expect(results).toContainEqual({
    ok: true,
    batchId: expect.any(String),
    acceptedCount: 2,
  });
  expect(results).toContainEqual({ ok: false, error: "selection_consumed" });
  expect(
    db.client
      .prepare("SELECT add_input,dry_run FROM ingestion_jobs ORDER BY position")
      .all(),
  ).toEqual([
    { add_input: "alpha", dry_run: 0 },
    { add_input: "beta", dry_run: 0 },
  ]);
});

test("search failures and a shared search and time limit create no jobs", async () => {
  const db = testDatabase();
  const tool = createSearchWebTool();
  const run = (ctx = context()) =>
    tool.execute!({ query: "Find festivals" }, ctx);
  vi.stubEnv("OPENROUTER_API_KEY", "");
  expect(await run()).toMatchObject({ error: "search_unavailable" });
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  const fetch = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ choices: [{ message: { annotations: [] } }] }),
    );
  vi.stubGlobal("fetch", fetch);
  const ctx = context();
  for (let i = 0; i < 3; i++) {
    expect(await run(ctx)).toMatchObject({ ok: true });
  }
  expect(await run(ctx)).toMatchObject({ error: "search_limit_searches" });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[0][1].body).plugins).toMatchObject([
    { id: "web", engine: "exa" },
  ]);
  vi.useFakeTimers();
  const expired = context();
  vi.advanceTimersByTime(600001);
  expect(await run(expired)).toMatchObject({ error: "search_limit_time" });
  vi.useRealTimers();
  fetch.mockImplementationOnce(async () => Response.json({}, { status: 401 }));
  expect(await run()).toMatchObject({ error: "search_unavailable" });
  expect(
    db.client.prepare("SELECT count(*) FROM ingestion_jobs").pluck().get(),
  ).toBe(0);
});

test.each([
  ["CATALOG_MAX_SEARCHES", "search_limit_searches"],
  ["CATALOG_MAX_DURATION_MS", "search_limit_time"],
])("configured zero %s prevents provider requests", async (name, error) => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubEnv(name, "0");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    await createSearchWebTool().execute!(
      { query: "Find festivals" },
      context(),
    ),
  ).toMatchObject({ error });
  expect(fetch).not.toHaveBeenCalled();
});

test("chat cancellation stops the search request and retry wait", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  const controller = new AbortController();
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    requested();
    return Response.json({}, { status: 429 });
  });
  vi.stubGlobal("fetch", fetch);
  const pending = createSearchWebTool().execute!(
    { query: "Find festivals" },
    { ...context(), abortSignal: controller.signal },
  );
  await started;
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  expect(await pending).toMatchObject({ error: "cancelled" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

test("invalid research settings affect search but leave submission, status, and cancellation available", async () => {
  const db = testDatabase();
  const captured = context();
  vi.stubEnv("CATALOG_MAX_PAGE_BYTES", "invalid");
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  const fetch = vi.fn(async () =>
    Response.json({ choices: [{ message: { annotations: [] } }] }),
  );
  vi.stubGlobal("fetch", fetch);
  const ctx = context();
  const add = await createAddEventsTool(() => db.path).execute!(
    { inputs: ["clue"], dryRun: true },
    ctx,
  );
  expect(add).toMatchObject({ ok: true, acceptedCount: 1 });
  expect(
    await createQueryCatalogTool(() => db.path).execute!(
      { sql: "SELECT count(*) FROM ingestion_jobs", parameters: [] },
      ctx,
    ),
  ).toMatchObject({ ok: true, rows: [[1]] });
  expect(
    await createSearchWebTool().execute!({ query: "Find festivals" }, ctx),
  ).toMatchObject({ error: "search_unavailable" });
  expect(fetch).not.toHaveBeenCalled();
  expect(
    await createSearchWebTool().execute!({ query: "Find festivals" }, captured),
  ).toMatchObject({ ok: true, candidates: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
  const batchId = db.client
    .prepare("SELECT batch_id FROM ingestion_jobs")
    .pluck()
    .get() as string;
  expect(
    await createCancelBatchTool(() => db.path).execute!({ batchId }, ctx),
  ).toMatchObject({ ok: true, cancelledCount: 1 });
});

test("search honors zero results and distinguishes provider errors from empty success", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  const fetch = vi.fn(async () =>
    Response.json({ error: { message: "private provider error" } }),
  );
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("CATALOG_MAX_SEARCH_RESULTS", "0");
  const tool = createSearchWebTool();
  expect(
    await tool.execute!({ query: "Find festivals" }, context()),
  ).toMatchObject({ ok: true, candidates: [] });
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv("CATALOG_MAX_SEARCH_RESULTS", "5");
  const result = await tool.execute!({ query: "Find festivals" }, context());
  expect(result).toMatchObject({ ok: false, error: "search_unavailable" });
  expect(JSON.stringify(result)).not.toContain("private provider error");
  expect(fetch).toHaveBeenCalledTimes(1);
  for (const response of [
    {},
    { choices: [] },
    { choices: [{ message: null }] },
    { choices: [{ message: "invalid message" }] },
    {
      choices: [{ message: {}, error: { message: "private choice error" } }],
    },
    { choices: [{ message: {}, finish_reason: "error" }] },
  ]) {
    fetch.mockImplementationOnce(async () => Response.json(response));
    const result = await tool.execute!({ query: "Find festivals" }, context());
    expect(result).toMatchObject({ ok: false, error: "search_unavailable" });
    expect(JSON.stringify(result)).not.toContain("private choice error");
  }
  expect(fetch).toHaveBeenCalledTimes(7);
  fetch.mockImplementationOnce(async () =>
    Response.json({ choices: [{ message: { annotations: [] } }] }),
  );
  expect(
    await tool.execute!({ query: "Find festivals" }, context()),
  ).toMatchObject({ ok: true, candidates: [] });
});
