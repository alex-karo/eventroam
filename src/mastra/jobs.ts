import { registerApiRoute } from "@mastra/core/server";
import { readDatabaseEnvironment } from "../db/env";
import { processJobs } from "../ingestion/jobs/processor";
import { openJobCatalog } from "../ingestion/jobs/store";
import type { ResearchLogger } from "../ingestion/runtime/logging";
import type { createStudioIngestionWorkflow } from "./ingestion";

/** Studio owns one queue loop and closes it before shared storage. */
export function createStudioJobs(
  workflow: ReturnType<typeof createStudioIngestionWorkflow>,
  log?: ResearchLogger,
) {
  const controller = new AbortController();
  let status: "idle" | "running" | "unavailable" | "stopped" = "idle";
  let pending: Promise<void> | undefined;
  const onSignal = () => {
    void stop().catch(() => {
      process.stderr.write("Studio ingestion queue cleanup failed.\n");
    });
  };
  const stop = async () => {
    // Abort before the server waits for active HTTP requests to finish.
    controller.abort();
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await pending;
    status = "stopped";
  };
  const start = () => {
    if (status !== "idle" || controller.signal.aborted) {
      return;
    }
    try {
      const client = openJobCatalog(readDatabaseEnvironment().DATABASE_PATH);
      status = "running";
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
      pending = processJobs({
        client,
        signal: controller.signal,
        execute: (job, signal) => workflow.executeJob(job, signal, log),
        log,
      })
        .catch(() => {
          status = "unavailable";
          process.stderr.write(
            "Studio ingestion queue unavailable. Check catalog storage.\n",
          );
        })
        .finally(() => client.close());
    } catch {
      status = "unavailable";
      process.stderr.write(
        "Studio ingestion queue unavailable. Check catalog storage.\n",
      );
    }
  };
  return {
    start,
    route: registerApiRoute("/ingestion-queue", {
      method: "GET",
      handler: async (c) =>
        c.json({ status }, status === "running" ? 200 : 503),
    }),
    stop,
  };
}
