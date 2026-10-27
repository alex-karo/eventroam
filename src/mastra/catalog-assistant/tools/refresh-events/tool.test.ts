import { noopObserve } from "@mastra/core/tools";
import { MessageList } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { assistantIngestionResult } from "@/test/assistant-ingestion";
import { testFixtures } from "@/test/fixtures";
import {
  studioIngestionInputSchema,
  studioIngestionResultSchema,
} from "../../../../ingestion/workflow";
import { assistantExecutionContext } from "../../execution-context";
import { createRefreshEventsTool } from "./tool";
import type { RefreshRun } from "./contracts";

const savedResult = assistantIngestionResult();

function context(threadId = "conversation-1") {
  const requestContext = new RequestContext();
  requestContext.set("refreshConsumed", true);
  requestContext.set("catalogAssistantConversation", "client-override");
  assistantExecutionContext.processInput({
    requestContext,
    messageList: new MessageList({ threadId }),
  } as Parameters<typeof assistantExecutionContext.processInput>[0]);
  return requestContext;
}
function setup(
  start = vi
    .fn<RefreshRun["start"]>()
    .mockResolvedValue({ result: savedResult }),
) {
  const db = testDatabase(),
    fixtures = testFixtures();
  const ids = [fixtures.event().id, fixtures.event().id, fixtures.event().id];
  const cancel = vi.fn().mockResolvedValue(undefined);
  const createRun = vi.fn(async () => ({ runId: "engine-1", start, cancel }));
  const tool = createRefreshEventsTool(() => db.path, { createRun });
  const execute = (
    eventIds = [ids[0]],
    requestContext = context(),
    abortSignal?: AbortSignal,
    options = {},
  ) =>
    tool.execute!(
      { eventIds, scope: "full", dryRun: true, ...options },
      { requestContext, abortSignal, observe: noopObserve },
    );
  return { ids, tool, execute, createRun, start, cancel };
}

test("tool schema and complete selection validation precede work and do not consume the turn", async () => {
  const fixture = setup(),
    requestContext = context();
  for (const ids of [
    [],
    [fixture.ids[0], fixture.ids[0]],
    [...fixture.ids, "fourth"],
    [fixture.ids[0], "missing"],
  ]) {
    await fixture.execute(ids, requestContext);
    expect(fixture.createRun).not.toHaveBeenCalled();
    expect(requestContext.get("refreshConsumed")).toBe(false);
  }
  expect(await fixture.execute(undefined, requestContext)).toMatchObject({
    ok: true,
    dryRun: true,
    scope: "full",
  });
  expect(fixture.start).toHaveBeenCalledWith({
    inputData: {
      mode: "refresh",
      eventId: fixture.ids[0],
      scope: "full",
      dryRun: true,
      republish: false,
    },
  });
});

test("refresh uses fresh sequential runs, forwards apply and current, and does not retry mixed failures", async () => {
  let failFirst!: (error: Error) => void;
  const start = vi.fn<RefreshRun["start"]>().mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failFirst = reject;
      }),
  );
  const fixture = setup(start);
  start
    .mockResolvedValueOnce({
      status: "failed",
      error: {
        message: JSON.stringify({
          code: "run_persistence_failed",
          summary: {
            ...savedResult,
            eventId: fixture.ids[1],
            engineRunId: "engine-2",
            dryRun: false,
            scope: "current",
            persistenceStatus: "failed",
            changedCount: 1,
            errorCodes: ["run_persistence_failed"],
          },
        }),
      },
    })
    .mockResolvedValueOnce({});
  fixture.createRun.mockImplementation(async () => ({
    runId: `engine-${fixture.createRun.mock.calls.length}`,
    start,
    cancel: fixture.cancel,
  }));
  const pending = fixture.execute(fixture.ids, context(), undefined, {
    dryRun: false,
    scope: "current",
  });
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  expect(fixture.createRun).toHaveBeenCalledTimes(1);
  failFirst(new Error("private error"));
  const result = await pending;
  expect(result).toMatchObject({
    ok: true,
    results: [
      {
        eventId: fixture.ids[0],
        engineRunId: "engine-1",
        error: "execution_failed",
      },
      {
        eventId: fixture.ids[1],
        result: {
          ingestionRunId: "ingestion-1",
          engineRunId: "engine-2",
          dryRun: false,
          changedCount: 1,
          persistenceStatus: "failed",
        },
      },
      { eventId: fixture.ids[2], engineRunId: "engine-3", error: "no_result" },
    ],
  });
  expect(fixture.createRun).toHaveBeenCalledTimes(3);
  const runs = await Promise.all(
    fixture.createRun.mock.results.map(({ value }) => value),
  );
  expect(new Set(runs).size).toBe(3);
  expect(start).toHaveBeenCalledTimes(3);
  fixture.ids.forEach((eventId, index) => {
    expect(start).toHaveBeenNthCalledWith(index + 1, {
      inputData: {
        mode: "refresh",
        eventId,
        scope: "current",
        dryRun: false,
        republish: false,
      },
    });
  });
  expect(JSON.stringify(result)).not.toContain("private error");
});

test("refresh preserves the safe summary from a real failed workflow start response", async () => {
  const db = testDatabase(),
    eventId = testFixtures().event().id;
  const summary = {
    ...savedResult,
    eventId,
    dryRun: false,
    outcome: "updated" as const,
    persistenceStatus: "failed" as const,
    changedCount: 1,
    errorCodes: ["run_persistence_failed"],
  };
  const workflow = createWorkflow({
    id: "failed-refresh-fixture",
    inputSchema: studioIngestionInputSchema,
    outputSchema: studioIngestionResultSchema,
  })
    .then(
      createStep({
        id: "finalize-run",
        inputSchema: studioIngestionInputSchema,
        outputSchema: studioIngestionResultSchema,
        execute: async () => {
          throw new Error(
            JSON.stringify({ code: "run_persistence_failed", summary }),
          );
        },
      }),
    )
    .commit();
  const run = await workflow.createRun({ runId: summary.engineRunId });
  const start = vi.spyOn(run, "start"),
    createRun = vi.fn(async () => run);
  const tool = createRefreshEventsTool(() => db.path, { createRun });
  const result = await tool.execute!(
    { eventIds: [eventId], scope: "full", dryRun: false },
    { requestContext: context(), observe: noopObserve },
  );
  const output = await start.mock.results[0].value;
  expect(output).toMatchObject({
    status: "failed",
    error: {
      message: JSON.stringify({ code: "run_persistence_failed", summary }),
    },
  });
  expect(output).not.toHaveProperty("result");
  expect(result).toMatchObject({
    ok: true,
    results: [{ eventId, result: summary }],
  });
  expect(createRun).toHaveBeenCalledOnce();
  expect(start).toHaveBeenCalledOnce();
});

test.each([
  "private database error",
  JSON.stringify({ code: "run_persistence_failed", summary: {} }),
  JSON.stringify({ code: "unknown_failure", summary: savedResult }),
])(
  "refresh hides unrecognized or invalid workflow errors (%#)",
  async (message) => {
    const fixture = setup(
      vi
        .fn()
        .mockResolvedValue({ status: "failed", error: new Error(message) }),
    );
    expect(await fixture.execute()).toMatchObject({
      ok: true,
      results: [
        {
          eventId: fixture.ids[0],
          engineRunId: "engine-1",
          error: "no_result",
        },
      ],
    });
  },
);

test("one consumed flag blocks parallel calls and retries even after failure; a new execution is fresh", async () => {
  const fixture = setup(vi.fn().mockRejectedValue(new Error("failure"))),
    requestContext = context();
  await Promise.all([
    fixture.execute(undefined, requestContext),
    fixture.execute(undefined, requestContext),
  ]);
  expect(fixture.createRun).toHaveBeenCalledTimes(1);
  expect(await fixture.execute(undefined, requestContext)).toMatchObject({
    error: "selection_consumed",
  });
  await fixture.execute(undefined, context());
  expect(fixture.createRun).toHaveBeenCalledTimes(2);
});

test("client controls cannot authorize a refresh without the execution processor", async () => {
  const fixture = setup(),
    requestContext = new RequestContext();
  requestContext.set("catalogAssistantHost", "catalog-assistant-host");
  requestContext.set("catalogAssistantConversation", "conversation-1");
  requestContext.set("refreshConsumed", false);
  expect(await fixture.execute(undefined, requestContext)).toMatchObject({
    error: "host_context_required",
  });
  expect(fixture.createRun).not.toHaveBeenCalled();
});

test("conversation guard blocks overlapping executions, allows other conversations, and releases after success", async () => {
  let finish!: (value: { result: typeof savedResult }) => void;
  const start = vi
    .fn<RefreshRun["start"]>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ result: savedResult });
  const fixture = setup(start);
  const first = fixture.execute();
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  expect(await fixture.execute()).toMatchObject({ error: "conversation_busy" });
  await fixture.execute(undefined, context("other"));
  expect(start).toHaveBeenCalledTimes(2);
  finish({ result: savedResult });
  await first;
  await fixture.execute();
  expect(start).toHaveBeenCalledTimes(3);
});

test("abort forwards once, removes listeners, stops later Events, and releases the conversation", async () => {
  let finish!: (value: { result: typeof savedResult }) => void;
  const start = vi
    .fn<RefreshRun["start"]>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ result: savedResult });
  const fixture = setup(start),
    controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const pending = fixture.execute(fixture.ids, context(), controller.signal);
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  controller.abort();
  finish({ result: savedResult });
  expect(await pending).toMatchObject({
    cancelled: true,
    results: [expect.any(Object)],
  });
  expect(fixture.cancel).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  expect(
    await fixture.execute(undefined, context(), AbortSignal.abort()),
  ).toMatchObject({ error: "cancelled" });
  await fixture.execute();
  expect(start).toHaveBeenCalledTimes(2);
});
