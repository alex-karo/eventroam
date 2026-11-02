import { setTimeout as delay } from "node:timers/promises";
import type Database from "better-sqlite3";
import type { ResearchLogger } from "../runtime/logging";
import { finishJob, nextJob, type IngestionJob } from "./store";

/** One loop per catalog. A saved running job starts again after process restart. */
export async function processJobs(options: {
  client: Database.Database;
  signal: AbortSignal;
  execute: (job: IngestionJob, signal: AbortSignal) => Promise<unknown>;
  log?: ResearchLogger;
}) {
  const { client, signal, execute, log } = options;
  while (!signal.aborted) {
    const job = nextJob(client);
    if (!job) {
      await delay(1000, undefined, { signal }).catch((error) => {
        if (!signal.aborted) {
          throw error;
        }
      });
      continue;
    }
    const started = performance.now();
    const fields = {
      batchId: job.batch_id,
      jobId: job.id,
      eventId: job.event_id,
    };
    log?.info("Ingestion job started", fields);
    let failed = false;
    try {
      await execute(job, signal);
    } catch {
      failed = true;
      log?.error("Ingestion job processing failed", {
        ...fields,
        errorCode: "execution_failed",
      });
    }
    // Cancellation can settle the workflow. It must not complete the interrupted job.
    if (signal.aborted) {
      log?.warn("Ingestion job interrupted", fields);
      return;
    }
    finishJob(client, job.id);
    log?.info("Ingestion job done", {
      ...fields,
      failed,
      durationMs: Math.round(performance.now() - started),
    });
  }
}
