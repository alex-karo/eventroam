import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { runFixtureResearch } from "@/test/ingestion";
import { submitJobs, nextJob } from "./store";

const failed = { status: "failed", data: null, errors: [], unresolved: [] };

test("attempt insertion or association failure prevents all external work", async () => {
  const { client } = testDatabase(),
    eventId = testFixtures().event().id;
  submitJobs(client, { eventIds: [eventId] });
  const job = nextJob(client)!;
  const generateCandidate = vi.fn().mockResolvedValue(failed);
  await expect(
    runFixtureResearch(
      { mode: "refresh", eventId, scope: "current", actor: "owner" },
      { client, jobId: job.id, generateCandidate },
    ),
  ).rejects.toThrow();
  expect(generateCandidate).not.toHaveBeenCalled();
  client.pragma("query_only = ON");
  try {
    await expect(
      runFixtureResearch(
        { mode: "refresh", eventId, actor: "owner" },
        { client, jobId: job.id, generateCandidate },
      ),
    ).rejects.toThrow();
    expect(generateCandidate).not.toHaveBeenCalled();
  } finally {
    client.pragma("query_only = OFF");
  }
  expect(
    client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
  ).toBe(0);
  await runFixtureResearch(
    { mode: "refresh", eventId, actor: "owner" },
    { client, jobId: job.id, generateCandidate },
  );
  expect(generateCandidate).toHaveBeenCalledOnce();
  expect(
    client.prepare("SELECT job_id,finished_at FROM ingestion_runs").get(),
  ).toEqual({ job_id: job.id, finished_at: expect.any(String) });
});
