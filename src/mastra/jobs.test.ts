import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { Hono } from "hono";
import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { createStudioIngestionWorkflow } from "./ingestion";
import { createStudioJobs } from "./jobs";

test.each(["missing", "unmigrated"])(
  "queue reports unavailable without creating or exposing a %s catalog",
  async (kind) => {
    const db = testDatabase();
    const path =
      kind === "missing" ? join(dirname(db.path), "absent.sqlite") : db.path;
    if (kind === "unmigrated") {
      db.client.exec("DROP TABLE ingestion_jobs");
    }
    vi.stubEnv("DATABASE_PATH", path);
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
      if (kind === "missing") {
        expect(existsSync(path)).toBe(false);
      }
    } finally {
      await jobs.stop();
      stderr.mockRestore();
    }
  },
);
