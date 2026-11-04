import Database from "better-sqlite3";
import type { DuckDBStore } from "@mastra/duckdb";
import { readDatabaseEnvironment } from "../db/env";
import { loadResearchConfig } from "../ingestion/runtime/config";
import {
  createCatalogIngestionWorkflow,
  type ResolveCatalogDependencies,
} from "../ingestion/workflow";
import type { IngestionJob } from "../ingestion/jobs/store";
import type { ResearchLogger } from "../ingestion/runtime/logging";

/** Inspection never invokes this resolver or opens the catalog. */
export function createStudioIngestionWorkflow(
  observabilityStore: DuckDBStore,
  resolveDependencies: ResolveCatalogDependencies = catalogDependencies(
    observabilityStore,
  ),
) {
  const jobIds = new Map<string, string>();
  const workflow = createCatalogIngestionWorkflow(
    async (input, engineRunId) => {
      const resolved = await resolveDependencies(input, engineRunId);
      return {
        ...resolved,
        deps: { ...resolved.deps, jobId: jobIds.get(engineRunId) },
      };
    },
  );
  return Object.assign(workflow, {
    async executeJob(
      job: IngestionJob,
      signal: AbortSignal,
      log?: ResearchLogger,
    ) {
      if (signal.aborted) {
        return { failed: false };
      }
      const run = await workflow.createRun();
      if (signal.aborted) {
        return { failed: false };
      }
      jobIds.set(run.runId, job.id);
      let cancellation: Promise<void> | undefined;
      const cancel = () => {
        cancellation ??= run.cancel();
        // Attach a handler immediately; cleanup awaits the original promise.
        void cancellation.catch(() => {});
      };
      signal.addEventListener("abort", cancel, { once: true });
      const fields = {
        jobId: job.id,
        batchId: job.batch_id,
        eventId: job.event_id,
        engineRunId: run.runId,
      };
      try {
        log?.info("Ingestion job workflow started", fields);
        const output = await run.start({
          inputData: {
            mode: "refresh",
            eventId: job.event_id,
            scope: job.scope,
            dryRun: Boolean(job.dry_run),
            republish: false,
          },
        });
        // Mastra can return canceled at runtime, but WorkflowResult omits it.
        const execution: { status: string } = output;
        const cancelled = execution.status === "canceled";
        const failed = output.status !== "success" && !cancelled;
        const completionLevel = cancelled ? "warn" : "info";
        log?.[failed ? "error" : completionLevel](
          "Ingestion job workflow ended",
          {
            ...fields,
            status: output.status,
            ...(output.status === "success"
              ? { ingestionRunId: output.result.ingestionRunId }
              : {}),
          },
        );
        return { failed };
      } finally {
        signal.removeEventListener("abort", cancel);
        try {
          await cancellation;
        } finally {
          jobIds.delete(run.runId);
        }
      }
    },
  });
}

function catalogDependencies(
  observabilityStore: DuckDBStore,
): ResolveCatalogDependencies {
  return async () => {
    const config = loadResearchConfig();
    const client = new Database(readDatabaseEnvironment().DATABASE_PATH, {
      fileMustExist: true,
    });
    try {
      client.pragma("foreign_keys = ON");
      client.pragma("busy_timeout = 5000");
      // Probe the required current schema without creating or migrating it.
      client
        .prepare(
          "SELECT id, input_json, report_json FROM ingestion_runs LIMIT 0",
        )
        .all();
      client.prepare("SELECT id FROM events LIMIT 0").all();
      return {
        deps: { client, config, observabilityStore },
        close: () => client.close(),
      };
    } catch {
      client.close();
      throw new Error("Ingestion prerequisites unavailable");
    }
  };
}
