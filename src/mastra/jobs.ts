import { registerApiRoute } from "@mastra/core/server";
import { readDatabaseEnvironment } from "../db/env";
import { processJobs } from "../ingestion/jobs/processor";
import { openJobCatalog } from "../ingestion/jobs/store";
import type { ResearchLogger } from "../ingestion/runtime/logging";
import type { createStudioIngestionWorkflow } from "./ingestion";
import type { MaintenanceControl } from "./maintenance";

/** Studio stops the queue processor before it closes shared storage. */
export function createStudioJobs(
  workflow: ReturnType<typeof createStudioIngestionWorkflow>,
  log?: ResearchLogger,
  maintenance?: MaintenanceControl,
) {
  const controller = new AbortController();
  let status: "idle" | "running" | "unavailable" | "stopped" = "idle";
  let pending: Promise<void> | undefined;
  const unavailable = (
    errorCode = "job_storage_unavailable",
    message = "Check catalog storage.",
  ) => {
    status = "unavailable";
    log?.error("Ingestion queue unavailable", { errorCode });
    process.stderr.write(`Studio ingestion queue unavailable. ${message}\n`);
  };
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
    const setting = process.env.CATALOG_JOB_CONCURRENCY?.trim();
    const concurrency = setting ? Number(setting) : undefined;
    if (
      concurrency !== undefined &&
      (!Number.isSafeInteger(concurrency) || concurrency < 1)
    ) {
      unavailable(
        "invalid_job_concurrency",
        "CATALOG_JOB_CONCURRENCY must be a positive safe integer.",
      );
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
        paused: maintenance?.paused,
        concurrency,
        execute: (job, signal) =>
          maintenance
            ? maintenance.run(() => workflow.executeJob(job, signal, log))
            : workflow.executeJob(job, signal, log),
        log,
      })
        .catch(() => unavailable())
        .finally(() => client.close());
    } catch {
      unavailable();
    }
  };
  return {
    start,
    route: registerApiRoute("/ingestion-queue", {
      method: "GET",
      handler: async (c) =>
        c.json(
          {
            status,
            ...(maintenance && {
              paused: maintenance.paused(),
              active:
                maintenance.active + workflow.historyControl.activeCount(),
            }),
          },
          status === "running" ? 200 : 503,
        ),
    }),
    stop,
  };
}
