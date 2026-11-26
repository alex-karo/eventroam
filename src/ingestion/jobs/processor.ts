import { EventEmitter, once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import type Database from "better-sqlite3";
import type { ResearchLogger } from "../runtime/logging";
import { finishJob, nextJob, type IngestionJob } from "./store";

/** A saved running job starts again after process restart. */
export async function processJobs(options: {
  client: Database.Database;
  signal: AbortSignal;
  execute: (
    job: IngestionJob,
    signal: AbortSignal,
  ) => Promise<void | { failed: boolean }>;
  log?: ResearchLogger;
  paused?: () => boolean;
  concurrency?: number;
}) {
  const { client, execute, log, concurrency = 3 } = options;
  const stop = new AbortController();
  const signal = AbortSignal.any([options.signal, stop.signal]);
  const active = new Map<string, Promise<void>>();
  const events = new EventEmitter();
  const stopOnFailure = (error: unknown) => {
    if (!signal.aborted) {
      stop.abort(error);
    }
  };

  async function runJob(job: IngestionJob) {
    const started = performance.now();
    const fields = {
      batchId: job.batch_id,
      jobId: job.id,
      mode: job.mode,
    };
    log?.info("Ingestion job started", fields);
    let failed = false;
    try {
      const result = await execute(job, signal);
      failed = result?.failed ?? false;
    } catch (error) {
      failed = true;
      if (!signal.aborted || error !== signal.reason) {
        log?.error("Ingestion job processing failed", {
          ...fields,
          errorCode: "execution_failed",
        });
      }
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

  try {
    while (!signal.aborted) {
      if (active.size >= concurrency) {
        await once(events, "finished");
        continue;
      }
      const job = options.paused?.()
        ? undefined
        : nextJob(client, active.keys());
      if (!job) {
        await delay(1000, undefined, { signal });
        continue;
      }
      const work = runJob(job)
        .catch(stopOnFailure)
        .finally(() => {
          active.delete(job.id);
          events.emit("finished");
        });
      active.set(job.id, work);
    }
  } catch (error) {
    stopOnFailure(error);
  }
  await Promise.all(active.values());
  if (stop.signal.aborted) {
    throw stop.signal.reason;
  }
}
