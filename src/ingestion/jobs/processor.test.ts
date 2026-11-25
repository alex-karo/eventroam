import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  submitJobs,
  cancelPendingJobs,
  nextJob,
  jobWorkflowInput,
} from "./store";
import { processJobs } from "./processor";

function setup(n = 4) {
  const db = testDatabase(),
    fixtures = testFixtures();
  const eventIds = Array.from({ length: n }, () => fixtures.event().id);
  return { ...db, eventIds, ...submitJobs(db.client, { eventIds }) };
}

test("a backup pause drains active jobs and leaves the next job pending", async () => {
  const { client } = setup();
  const controller = new AbortController();
  let paused = false;
  const complete: (() => void)[] = [];
  const started: string[] = [];
  const work = processJobs({
    client,
    signal: controller.signal,
    paused: () => paused,
    execute: async (job) => {
      started.push(job.id);
      await new Promise<void>((resolve) => {
        complete.push(resolve);
      });
    },
  });
  expect(started).toHaveLength(3);
  paused = true;
  complete.forEach((finish) => finish());
  await expect
    .poll(() =>
      client
        .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
        .pluck()
        .get(),
    )
    .toBe(3);
  expect(started).toHaveLength(3);
  expect(
    client
      .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='pending'")
      .pluck()
      .get(),
  ).toBe(1);
  controller.abort();
  await work;
});

test("a malformed stored target ends independently and the next job runs", async () => {
  const { client, eventIds } = setup(2);
  client.prepare("UPDATE ingestion_jobs SET mode='add' WHERE position=0").run();
  const controller = new AbortController();
  const executed: string[] = [];
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async (job) => {
      const input = jobWorkflowInput(job);
      if (input.mode === "refresh") {
        executed.push(input.input.eventId);
      }
    },
  });
  await expect
    .poll(() =>
      client
        .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
        .pluck()
        .get(),
    )
    .toBe(2);
  controller.abort();
  await work;
  expect(executed).toEqual([eventIds[1]]);
  expect(
    client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
  ).toBe(0);
});

test("starts at most three jobs in queue order and fills a slot after an ordinary failure", async () => {
  const { client, eventIds } = setup();
  const controller = new AbortController();
  const started: string[] = [];
  const complete: (() => void)[] = [];
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async (job) => {
      const input = jobWorkflowInput(job);
      if (input.mode === "refresh") {
        started.push(input.input.eventId);
      }
      await new Promise<void>((resolve) => {
        complete[job.position] = resolve;
      });
      if (job.position === 1) {
        throw new Error("Private workflow failure");
      }
    },
  });
  try {
    expect(started).toEqual(eventIds.slice(0, 3));
    complete[1]();
    await expect.poll(() => started.slice()).toEqual(eventIds);
    expect(
      client
        .prepare("SELECT position FROM ingestion_jobs WHERE status='done'")
        .pluck()
        .all(),
    ).toEqual([1]);
    complete.forEach((finish) => finish());
    await expect
      .poll(() =>
        client
          .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
          .pluck()
          .get(),
      )
      .toBe(4);
  } finally {
    controller.abort();
    complete.forEach((finish) => finish());
    await work;
  }
});

test("queue completion failure stops dispatch and leaves the job eligible after restart", async () => {
  const { client } = setup();
  const calls: string[] = [];
  const cleaned: string[] = [];
  await expect(
    processJobs({
      client,
      signal: new AbortController().signal,
      execute: async (job, signal) => {
        calls.push(job.id);
        if (job.position === 0) {
          // Let the queue start the other jobs before the write fails.
          await Promise.resolve();
          client.pragma("query_only = ON");
          return;
        }
        await delay(30000, undefined, { signal }).catch(() => {});
        cleaned.push(job.id);
      },
    }),
  ).rejects.toThrow("job_storage_unavailable");
  client.pragma("query_only = OFF");
  expect(calls).toHaveLength(3);
  expect(cleaned).toEqual(calls.slice(1));
  expect(nextJob(client)?.id).toBe(calls[0]);
});

test("shutdown awaits all active jobs and leaves their status running", async () => {
  const { client, batchId } = setup();
  const controller = new AbortController();
  let cleaned = 0;
  const work = processJobs({
    client,
    signal: controller.signal,
    execute: async (_job, signal) => {
      await delay(30000, undefined, { signal }).catch(() => {});
      await delay(5);
      cleaned++;
    },
  });
  controller.abort();
  controller.abort();
  await work;
  expect(cleaned).toBe(3);
  expect(cancelPendingJobs(client, batchId)).toMatchObject({
    cancelledCount: 1,
  });
  expect(
    client
      .prepare(
        "SELECT status,count(*) n FROM ingestion_jobs GROUP BY status ORDER BY status",
      )
      .all(),
  ).toEqual([
    { status: "cancelled", n: 1 },
    { status: "running", n: 3 },
  ]);
});
