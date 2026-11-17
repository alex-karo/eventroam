import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { CatalogAttempt } from "./attempt";
import {
  submitJobs,
  nextJob,
  jobWorkflowInput,
  JobStorageError,
} from "./jobs/store";
import { scopePresets, type ScopeDefinition } from "./scope";

test.each([
  { version: 1, tasks: [] },
  {
    version: 1,
    tasks: [{ target: "event", fields: ["description"], instruction: "  " }],
  },
  { version: 1, tasks: [{ target: "latestCompleted", fields: ["tickets"] }] },
  { version: 1, tasks: [{ target: 1, fields: ["dates"] }] },
  {
    version: 1,
    tasks: [{ target: "event", fields: ["description", "description"] }],
  },
])("invalid tasks create no jobs, attempts, or external work: %j", (scope) => {
  const { client } = testDatabase();
  const eventId = testFixtures().event().id;
  const generateRole = vi.fn();
  expect(() =>
    submitJobs(client, { eventIds: [eventId], scope } as never),
  ).toThrow();
  expect(
    () =>
      new CatalogAttempt(
        "engine",
        { mode: "refresh", eventId, actor: "owner", scope } as never,
        { client, generateRole },
      ),
  ).toThrow();
  expect(client.prepare("SELECT * FROM ingestion_jobs").all()).toEqual([]);
  expect(client.prepare("SELECT * FROM ingestion_runs").all()).toEqual([]);
  expect(generateRole).not.toHaveBeenCalled();
});

test("custom queued requests compare by value and keep task values through restarts", () => {
  const { client } = testDatabase();
  const eventId = testFixtures().event().id;
  const scope: ScopeDefinition = {
    version: 1,
    tasks: [
      { target: "event", fields: ["description"] },
      {
        target: "currentOrNext",
        fields: ["sizeEstimate"],
        instruction: "Use found evidence.",
        required: false,
      },
    ],
  };
  submitJobs(client, { eventIds: [eventId], scope, dryRun: false });
  const job = nextJob(client)!;
  const readInput = () => {
    const accepted = jobWorkflowInput(nextJob(client)!);
    if (accepted.mode !== "refresh") {
      throw new Error("Expected refresh");
    }
    return {
      ...accepted.input,
      mode: "refresh" as const,
      actor: "owner",
      dryRun: accepted.dryRun,
    };
  };
  for (let count = 0; count < 2; count++) {
    const attempt = new CatalogAttempt(`engine-${count}`, readInput(), {
      client,
      jobId: job.id,
      generateRole: vi.fn(),
    });
    const stored = JSON.parse(
      client
        .prepare("SELECT input_json FROM ingestion_runs WHERE id=?")
        .pluck()
        .get(attempt.ingestionRunId) as string,
    );
    expect(stored.scope).toEqual(scope);
    expect(stored.normalizedScope).toEqual({
      version: 1,
      tasks: [{ ...scope.tasks[0], required: true }, scope.tasks[1]],
    });
    expect(stored.normalizedScope.tasks[0]).not.toHaveProperty("instruction");
    expect(stored.dryRun).toBe(false);
    expect(stored.republish).toBe(false);
  }
  const changed = readInput();
  changed.scope = { ...scope, tasks: [...scope.tasks].reverse() };
  expect(
    () =>
      new CatalogAttempt("changed", changed, {
        client,
        jobId: job.id,
        generateRole: vi.fn(),
      }),
  ).toThrow();
  expect(
    client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
  ).toBe(2);
});

test("invalid batch scope returns input paths before accepting any Event", () => {
  const { client } = testDatabase();
  const fixtures = testFixtures();
  const eventIds = [fixtures.event().id, fixtures.event().id];
  try {
    submitJobs(client, {
      eventIds,
      scope: {
        version: 1,
        tasks: [{ target: "event", fields: ["description"], instruction: " " }],
      },
    });
    throw new Error("Expected invalid scope");
  } catch (error) {
    expect(error).toBeInstanceOf(JobStorageError);
    expect((error as JobStorageError).issues).toContainEqual(
      expect.objectContaining({ path: ["scope", "tasks", 0, "instruction"] }),
    );
  }
  expect(client.prepare("SELECT * FROM ingestion_jobs").all()).toEqual([]);
});

test("name-only jobs expand the deployed preset at each attempt and preserve earlier scope", () => {
  const { client } = testDatabase();
  const eventId = testFixtures().event().id;
  submitJobs(client, { eventIds: [eventId], scope: "current" });
  const job = nextJob(client)!;
  const first = new CatalogAttempt(
    "first",
    { mode: "refresh", eventId, scope: "current", actor: "owner" },
    { client, jobId: job.id, generateRole: vi.fn() },
  );
  const before = client
    .prepare("SELECT input_json FROM ingestion_runs WHERE id=?")
    .pluck()
    .get(first.ingestionRunId);
  const original = scopePresets.current.tasks;
  try {
    scopePresets.current.tasks = [
      { target: "currentOrNext", fields: ["dates"] },
    ];
    const second = new CatalogAttempt(
      "second",
      { mode: "refresh", eventId, scope: "current", actor: "owner" },
      { client, jobId: job.id, generateRole: vi.fn() },
    );
    expect(second.input.normalizedScope?.tasks).toEqual([
      { target: "currentOrNext", fields: ["dates"], required: true },
    ]);
    expect(first.input.normalizedScope?.tasks).not.toEqual(
      second.input.normalizedScope?.tasks,
    );
    expect(
      client
        .prepare("SELECT input_json FROM ingestion_runs WHERE id=?")
        .pluck()
        .get(first.ingestionRunId),
    ).toBe(before);
    expect(JSON.parse(job.input).scope).toBe("current");
  } finally {
    scopePresets.current.tasks = original;
  }
});
