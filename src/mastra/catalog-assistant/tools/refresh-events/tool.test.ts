import { noopObserve } from "@mastra/core/tools";
import { MessageList } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { assistantExecutionContext } from "../../execution-context";
import { createRefreshEventsTool } from "./tool";
import { createCancelRefreshTool } from "../cancel-refresh/tool";

function context() {
  const requestContext = new RequestContext();
  assistantExecutionContext.processInput({
    requestContext,
    messageList: new MessageList({ threadId: "owner" }),
  } as Parameters<typeof assistantExecutionContext.processInput>[0]);
  return requestContext;
}
function setup(n = 3) {
  const db = testDatabase(),
    fixtures = testFixtures();
  const eventIds = Array.from({ length: n }, () => fixtures.event().id);
  const tool = createRefreshEventsTool(() => db.path);
  const execute = (
    ids = eventIds,
    requestContext = context(),
    abortSignal?: AbortSignal,
  ) =>
    tool.execute!(
      { eventIds: ids, scope: "full", dryRun: true },
      { requestContext, abortSignal, observe: noopObserve },
    );
  return { db, eventIds, tool, execute };
}

test("invalid input does not consume the selection; acceptance needs no queue loop or credentials", async () => {
  const fixture = setup(),
    requestContext = context();
  for (const ids of [
    [],
    [fixture.eventIds[0], fixture.eventIds[0]],
    ["missing"],
    Array.from({ length: 201 }, (_, i) => `event-${i}`),
  ]) {
    await fixture.execute(ids, requestContext);
    expect(requestContext.get("refreshConsumed")).toBe(false);
  }
  const accepted = await fixture.execute(undefined, requestContext);
  expect(accepted).toEqual({
    ok: true,
    batchId: expect.any(String),
    acceptedCount: 3,
  });
  expect(requestContext.get("refreshConsumed")).toBe(true);
  expect(await fixture.execute(undefined, requestContext)).toMatchObject({
    ok: false,
    error: "selection_consumed",
  });
  expect(
    fixture.db.client.prepare("SELECT count(*) n FROM ingestion_runs").get(),
  ).toEqual({ n: 0 });
});

test("parallel calls share the host flag and a new execution can submit again", async () => {
  const fixture = setup(),
    requestContext = context();
  const results = await Promise.all([
    fixture.execute(undefined, requestContext),
    fixture.execute(undefined, requestContext),
  ]);
  expect(
    results.filter((result) => (result as { ok?: boolean }).ok),
  ).toHaveLength(1);
  expect(results).toContainEqual({ ok: false, error: "selection_consumed" });
  await fixture.execute();
  expect(
    fixture.db.client.prepare("SELECT count(*) n FROM ingestion_jobs").get(),
  ).toEqual({ n: 6 });
});

test("request abort before submission prevents acceptance; abort after commit preserves jobs", async () => {
  const fixture = setup(),
    controller = new AbortController();
  expect(
    await fixture.execute(undefined, context(), AbortSignal.abort()),
  ).toMatchObject({ ok: false, error: "cancelled" });
  expect(
    fixture.db.client.prepare("SELECT count(*) n FROM ingestion_jobs").get(),
  ).toEqual({ n: 0 });
  const pending = fixture.execute(undefined, context(), controller.signal);
  controller.abort();
  expect(await pending).toMatchObject({ ok: true, acceptedCount: 3 });
  expect(
    fixture.db.client
      .prepare("SELECT DISTINCT status FROM ingestion_jobs")
      .all(),
  ).toEqual([{ status: "pending" }]);
});

test("batch cancellation works with no queue loop and leaves unknown batches unchanged", async () => {
  const fixture = setup();
  const accepted = (await fixture.execute()) as { batchId: string };
  const tool = createCancelRefreshTool(() => fixture.db.path);
  const execute = (batchId: string) =>
    tool.execute!(
      { batchId },
      { requestContext: context(), observe: noopObserve },
    );
  expect(await execute(accepted.batchId)).toMatchObject({
    ok: true,
    cancelledCount: 3,
  });
  expect(await execute("00000000-0000-4000-8000-000000000001")).toMatchObject({
    ok: false,
    error: "batch_not_found",
  });
});

test("lost responses with failed logging preserve accepted jobs and do not resubmit", async () => {
  const fixture = setup(),
    requestContext = context();
  const logging = {
    native: {
      info: () => {
        throw new Error("private sink failure");
      },
    },
    observability: { getDefaultInstance: () => undefined },
    level: "info",
    diagnose: vi.fn(),
  } as unknown as Parameters<typeof createRefreshEventsTool>[1];
  const tool = createRefreshEventsTool(() => fixture.db.path, logging);
  await tool.execute!(
    { eventIds: fixture.eventIds, scope: "full", dryRun: true },
    { requestContext, observe: noopObserve },
  );
  expect(await fixture.execute(undefined, requestContext)).toMatchObject({
    ok: false,
    error: "selection_consumed",
  });
  expect(
    fixture.db.client.prepare("SELECT count(*) n FROM ingestion_jobs").get(),
  ).toEqual({ n: 3 });
});

test("submission errors consume the turn after validation and never return a cached acceptance", async () => {
  const store = await import("../../../../ingestion/jobs/store");
  const fixture = setup(),
    requestContext = context();
  const submit = vi
    .spyOn(store, "submitJobs")
    .mockImplementationOnce((_client, _input, consume) => {
      consume!();
      throw new store.JobStorageError("job_storage_unavailable");
    });
  try {
    expect(await fixture.execute(undefined, requestContext)).toMatchObject({
      ok: false,
      error: "job_storage_unavailable",
    });
    expect(await fixture.execute(undefined, requestContext)).toMatchObject({
      ok: false,
      error: "selection_consumed",
    });
    expect(
      fixture.db.client
        .prepare("SELECT count(*) FROM ingestion_jobs")
        .pluck()
        .get(),
    ).toBe(0);
  } finally {
    submit.mockRestore();
  }
});
