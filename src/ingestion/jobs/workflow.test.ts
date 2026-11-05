import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  fixtureDependencies,
  fixtureTargets,
  runFixtureResearch,
  set,
} from "@/test/ingestion";
import { processJobs } from "./processor";
import {
  submitJobs,
  submitAddJobs,
  jobWorkflowInput,
  nextJob,
  finishJob,
} from "./store";

const failed = { checks: [], unresolved: [] };

test.each(["before-attempt", "after-finalize"])(
  "restart at %s preserves completed writes and earlier attempts",
  async (phase) => {
    const { client } = testDatabase();
    const event = testFixtures().event();
    submitJobs(client, {
      eventIds: [event.id],
      dryRun: false,
    });
    const jobId = nextJob(client)!.id;
    const execute = () =>
      runFixtureResearch(
        { mode: "refresh", eventId: event.id, dryRun: false, actor: "fixture" },
        {
          client,
          jobId,
          ...fixtureDependencies({
            general: async () => ({
              ...fixtureTargets(event.id),
              observedEventName: event.canonicalName,
              event: { summary: set("SAVED_SUMMARY") },
              previousEdition: null,
              currentOrNextEdition: null,
            }),
          }),
        },
      );
    if (phase === "after-finalize") {
      await execute();
    }
    const earlier = client.prepare("SELECT * FROM ingestion_runs").all();
    expect(earlier).toHaveLength(phase === "before-attempt" ? 0 : 1);
    expect(nextJob(client)?.id).toBe(jobId);
    if (phase === "after-finalize") {
      expect(
        client.prepare("SELECT summary FROM events WHERE id=?").get(event.id),
      ).toEqual({ summary: "SAVED_SUMMARY" });
    }
    const restarted = new AbortController();
    const work = processJobs({
      client,
      signal: restarted.signal,
      execute: async () => {
        await execute();
      },
    });
    try {
      await expect
        .poll(() =>
          client
            .prepare("SELECT status FROM ingestion_jobs WHERE id=?")
            .pluck()
            .get(jobId),
        )
        .toBe("done");
    } finally {
      restarted.abort();
      await work;
    }
    const all = client
      .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
      .all();
    expect(all.slice(0, earlier.length)).toEqual(earlier);
    expect(all).toHaveLength(earlier.length + 1);
    expect(all.at(-1)).toMatchObject({
      job_id: jobId,
      finished_at: expect.any(String),
    });
    expect(
      client.prepare("SELECT summary FROM events WHERE id=?").get(event.id),
    ).toEqual({ summary: "SAVED_SUMMARY" });
    expect(new Set(all.map((row) => (row as { id: string }).id)).size).toBe(
      all.length,
    );
  },
);

test("attempt insertion or association failure prevents all external work", async () => {
  const { client } = testDatabase(),
    eventId = testFixtures().event().id;
  submitJobs(client, { eventIds: [eventId] });
  const job = nextJob(client)!;
  const generateRole = vi.fn().mockResolvedValue(failed);
  await expect(
    runFixtureResearch(
      { mode: "refresh", eventId, scope: "current", actor: "owner" },
      { client, jobId: job.id, generateRole },
    ),
  ).rejects.toThrow();
  expect(generateRole).not.toHaveBeenCalled();
  client.pragma("query_only = ON");
  try {
    await expect(
      runFixtureResearch(
        { mode: "refresh", eventId, actor: "owner" },
        { client, jobId: job.id, generateRole },
      ),
    ).rejects.toThrow();
    expect(generateRole).not.toHaveBeenCalled();
  } finally {
    client.pragma("query_only = OFF");
  }
  expect(
    client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
  ).toBe(0);
  await runFixtureResearch(
    { mode: "refresh", eventId, actor: "owner" },
    { client, jobId: job.id, generateRole },
  );
  expect(generateRole).toHaveBeenCalledOnce();
  expect(
    client.prepare("SELECT job_id,finished_at FROM ingestion_runs").get(),
  ).toEqual({ job_id: job.id, finished_at: expect.any(String) });
});

test("restarted add skips a committed duplicate with two linked attempts and later items still execute", async () => {
  const { client } = testDatabase();
  submitAddJobs(client, {
    inputs: ["Example Fest", "Unclear Event", "https://other.test/"],
    dryRun: false,
  });
  const job = nextJob(client)!;
  const run = (selected: typeof job, duplicate = false) =>
    runFixtureResearch(
      { ...jobWorkflowInput(selected), actor: "owner" },
      {
        client,
        jobId: selected.id,
        ...fixtureDependencies({
          general: async (_role: unknown, prompt: string) => {
            if (selected.position === 1) {
              return {
                decision: "uncertain",
                reason: "Clues are ambiguous",
                unresolved: [],
              };
            }
            if (duplicate) {
              return {
                decision: "duplicate",
                eventId: JSON.parse(prompt).candidates[0].id,
                observedEventName: "Example Fest",
                reason: "Inspected source confirms the saved name",
                evidenceIds: ["s1-e1"],
              };
            }
            const targets = fixtureTargets();
            targets.observedEventName =
              selected.position === 2 ? "Other Festival" : "Example Fest";
            return targets;
          },
        }),
      },
    );
  const first = await run(job);
  expect(first.outcome).not.toBe("failed");
  expect(client.prepare("SELECT count(*) FROM events").pluck().get()).toBe(1);
  const repeated = await run(nextJob(client)!, true);
  expect(repeated).toMatchObject({
    outcome: "skipped",
    eventId: first.eventId,
  });
  expect(
    client.prepare("SELECT job_id FROM ingestion_runs ORDER BY rowid").all(),
  ).toEqual([{ job_id: job.id }, { job_id: job.id }]);
  finishJob(client, job.id);
  const failedJob = nextJob(client)!;
  expect((await run(failedJob)).outcome).toBe("failed");
  finishJob(client, failedJob.id);
  const finalJob = nextJob(client)!;
  expect((await run(finalJob)).outcome).not.toBe("failed");
  finishJob(client, finalJob.id);
  expect(nextJob(client)).toBeUndefined();
  expect(client.prepare("SELECT count(*) FROM events").pluck().get()).toBe(2);
});
