import { setTimeout as delay } from "node:timers/promises";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { submitJobs, cancelPendingJobs, nextJob } from "./store";
import { processJobs } from "./processor";

function testLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

function setup(n = 4) {
  const db = testDatabase(),
    fixtures = testFixtures();
  const eventIds = Array.from({ length: n }, () => fixtures.event().id);
  return { ...db, eventIds, ...submitJobs(db.client, { eventIds }) };
}

test("one awaited loop preserves order, continues ordinary failures, and never overlaps", async () => {
  const { client, eventIds } = setup();
  const controller = new AbortController();
  const started: string[] = [];
  let active = 0,
    maxActive = 0;
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async (job) => {
      started.push(job.event_id);
      maxActive = Math.max(maxActive, ++active);
      await delay(5);
      active--;
      if (started.length === 1) {
        throw new Error("Private workflow failure");
      }
    },
  });
  await expect
    .poll(() =>
      client
        .prepare("SELECT count(*) n FROM ingestion_jobs WHERE status='done'")
        .pluck()
        .get(),
    )
    .toBe(4);
  controller.abort();
  await work;
  expect(started).toEqual(eventIds);
  expect(maxActive).toBe(1);
  expect(
    client.prepare("SELECT count(*) n FROM ingestion_runs").pluck().get(),
  ).toBe(0);
});

test("queue completion failure stops dispatch and leaves the job eligible after restart", async () => {
  const { client } = setup(2);
  const calls: string[] = [];
  await expect(
    processJobs({
      client,
      signal: new AbortController().signal,
      execute: async (job) => {
        calls.push(job.id);
        // Fail only queue writes; processing itself has ended.
        client.pragma("query_only = ON");
      },
    }),
  ).rejects.toThrow("job_storage_unavailable");
  client.pragma("query_only = OFF");
  expect(calls).toHaveLength(1);
  expect(nextJob(client)?.id).toBe(calls[0]);
});

test("shutdown awaits active cleanup, leaves running, and never claims another job", async () => {
  const { client, batchId } = setup();
  const controller = new AbortController();
  let cleanup = false;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async (_job, signal) => {
      started();
      await delay(30000, undefined, { signal }).catch(() => {});
      await delay(5);
      cleanup = true;
    },
  });
  await entered;
  controller.abort();
  controller.abort();
  await work;
  expect(cleanup).toBe(true);
  expect(cancelPendingJobs(client, batchId)).toMatchObject({
    cancelledCount: 3,
  });
  expect(
    client
      .prepare(
        "SELECT status,count(*) n FROM ingestion_jobs GROUP BY status ORDER BY status",
      )
      .all(),
  ).toEqual([
    { status: "cancelled", n: 3 },
    { status: "running", n: 1 },
  ]);
});

test("a returned workflow failure is recorded in the job completion log", async () => {
  const { client } = setup(1);
  const controller = new AbortController();
  const log = testLogger();
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async () => ({ failed: true }),
    log,
  });
  try {
    await expect
      .poll(() =>
        log.info.mock.calls.some(
          ([message]) => message === "Ingestion job done",
        ),
      )
      .toBe(true);
    expect(log.info).toHaveBeenCalledWith(
      "Ingestion job done",
      expect.objectContaining({ failed: true }),
    );
  } finally {
    controller.abort();
    await work;
  }
});

test("shutdown alone does not hide an unconfirmed execution error", async () => {
  const { client } = setup(1);
  const controller = new AbortController();
  const log = testLogger();
  await processJobs({
    client,
    signal: controller.signal,
    execute: async () => {
      controller.abort();
      throw new Error("Private storage failure during shutdown");
    },
    log,
  });
  expect(log.error).toHaveBeenCalledWith(
    "Ingestion job processing failed",
    expect.objectContaining({ errorCode: "execution_failed" }),
  );
  expect(log.warn).toHaveBeenCalledWith(
    "Ingestion job interrupted",
    expect.any(Object),
  );
});

test("confirmed cancellation does not emit an execution error", async () => {
  const { client } = setup(1);
  const controller = new AbortController();
  const log = testLogger();
  await processJobs({
    client,
    signal: controller.signal,
    log,
    execute: async () => {
      controller.abort();
      controller.signal.throwIfAborted();
    },
  });
  expect(log.error).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledWith(
    "Ingestion job interrupted",
    expect.any(Object),
  );
  expect(
    client.prepare("SELECT status FROM ingestion_jobs").pluck().get(),
  ).toBe("running");
});
