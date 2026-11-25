import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { Hono } from "hono";
import { expect, test, vi } from "vitest";
import { submitJobs } from "@/ingestion/jobs/store";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { createStudioIngestionWorkflow } from "./ingestion";
import { createStudioJobs } from "./jobs";

test.each([
  ["missing catalog", undefined],
  ["unmigrated catalog", undefined],
  ["zero queue limit", "0"],
  ["fractional queue limit", "1.5"],
  ["unsafe queue limit", "9007199254740992"],
])("queue reports unavailable for %s", async (kind, concurrency) => {
  const db = testDatabase();
  const path =
    kind === "missing catalog"
      ? join(dirname(db.path), "absent.sqlite")
      : db.path;
  if (kind === "unmigrated catalog") {
    db.client.exec("DROP TABLE ingestion_jobs");
  }
  vi.stubEnv("DATABASE_PATH", path);
  vi.stubEnv("CATALOG_JOB_CONCURRENCY", concurrency);
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const workflow = createStudioIngestionWorkflow(
    new DuckDBStore({ path: join(dirname(db.path), "unused.duckdb") }),
  );
  const jobs = createStudioJobs(workflow);
  try {
    const app = new Hono();
    const route = jobs.route;
    if (!("handler" in route) || "_mastraSchemaRoute" in route) {
      throw new Error("Expected a Hono route");
    }
    app.get(route.path, route.handler);
    jobs.start();
    const response = await app.request("/ingestion-queue");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(Object.keys(workflow.steps)).toContain("general-facts");
    expect(stderr).toHaveBeenCalledOnce();
    expect(stderr.mock.calls[0][0]).not.toContain(path);
    if (concurrency !== undefined) {
      expect(stderr.mock.calls[0][0]).toContain("CATALOG_JOB_CONCURRENCY");
    }
    if (kind === "missing catalog") {
      expect(existsSync(path)).toBe(false);
    }
  } finally {
    await jobs.stop();
    stderr.mockRestore();
  }
});

test.each([
  [3, "   "],
  [4, String(Number.MAX_SAFE_INTEGER)],
])("Studio starts %i jobs with queue limit %j", async (active, concurrency) => {
  const { client, path } = testDatabase();
  const fixtures = testFixtures(client);
  submitJobs(client, {
    eventIds: Array.from({ length: 4 }, () => fixtures.event().id),
  });
  vi.stubEnv("DATABASE_PATH", path);
  vi.stubEnv("CATALOG_JOB_CONCURRENCY", concurrency);
  const workflow = createStudioIngestionWorkflow(
    new DuckDBStore({ path: join(dirname(path), "unused.duckdb") }),
  );
  const complete = Promise.withResolvers<{ failed: boolean }>();
  const execute = vi
    .spyOn(workflow, "executeJob")
    .mockReturnValue(complete.promise);
  const jobs = createStudioJobs(workflow);
  try {
    jobs.start();
    expect(execute).toHaveBeenCalledTimes(active);
  } finally {
    complete.resolve({ failed: false });
    await jobs.stop();
  }
});
