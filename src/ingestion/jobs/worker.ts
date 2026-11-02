import { noopLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import type { DuckDBStore } from "@mastra/duckdb";
import type { ResearchDependencies } from "../contracts";
import { loadResearchConfig } from "../runtime/config";
import {
  createApplicationLogger,
  createPinoLogger,
  researchLogLevel,
} from "../runtime/logging";
import { createDiagnostics } from "../runtime/observability/diagnostics";
import { createObservabilityStore } from "../runtime/observability/storage";
import {
  createCatalogObservability,
  flushObservability,
} from "../runtime/observability/runtime";
import { diagnosticStoragePaths, filesAlias } from "../runtime/storage-paths";
import { createWorkflowStorage } from "../runtime/workflow-storage";
import { createCatalogIngestionWorkflow } from "../workflow";
import { processJobs } from "./processor";
import { openJobCatalog, type IngestionJob } from "./store";

export function workerStoragePaths(env: NodeJS.ProcessEnv = process.env) {
  const studio = diagnosticStoragePaths(env);
  const worker = diagnosticStoragePaths({
    ...env,
    CATALOG_OBSERVABILITY_DATABASE_PATH:
      env.CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH?.trim() ||
      "data/mastra-worker-observability.duckdb",
  });
  if (
    [studio.observability, `${studio.observability}.wal`].some((file) =>
      [worker.observability, `${worker.observability}.wal`].some((other) =>
        filesAlias(file, other),
      ),
    )
  ) {
    throw new Error("Worker observations must use a separate DuckDB file");
  }
  return worker;
}

/** No HTTP, chat, or eval stores. The caller owns the shutdown signal. */
export async function runIngestionWorker(options: {
  catalogPath: string;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv;
  researchDependencies?: Omit<
    ResearchDependencies,
    "client" | "jobId" | "workflowStorage" | "observabilityStore"
  >;
}) {
  const env = options.env ?? process.env;
  const paths = workerStoragePaths({
    ...env,
    DATABASE_PATH: options.catalogPath,
  });
  const client = openJobCatalog(options.catalogPath);
  const diagnose = createDiagnostics();
  let observations: DuckDBStore | undefined;
  let host: Mastra | undefined;
  let storage: ReturnType<typeof createWorkflowStorage> | undefined;
  try {
    // Observations are optional. Required workflow history is initialized below.
    try {
      observations = await createObservabilityStore({
        ...env,
        DATABASE_PATH: options.catalogPath,
        CATALOG_OBSERVABILITY_DATABASE_PATH: paths.observability,
      });
      observations.__setLogger(noopLogger);
      await observations.init();
    } catch {
      diagnose("trace_initialization_failed");
      await observations?.close().catch(() => {});
      observations = undefined;
    }
    let current: IngestionJob | undefined;
    const workflow = createCatalogIngestionWorkflow(async () => {
      if (!current) {
        throw new Error("Job unavailable");
      }
      return {
        deps: {
          ...options.researchDependencies,
          client,
          jobId: current.id,
          config:
            options.researchDependencies?.config ?? loadResearchConfig(env),
          observabilityStore: observations ?? null,
        },
      };
    });
    storage = createWorkflowStorage({
      path: paths.workflow,
      observability: observations,
      onFailure: workflow.historyControl.recoverHistory,
    });
    await storage.init();
    const logging = env.CATALOG_LOGGING === "true";
    const level = researchLogLevel(logging);
    const native = logging
      ? createPinoLogger(level, () => diagnose("log_write_failed"))
      : undefined;
    host = new Mastra({
      workflows: { "catalog-ingestion": workflow },
      storage,
      logger: native ?? false,
      loggerOptions: { export: logging },
      ...(logging && observations
        ? {
            observability: createCatalogObservability({
              traceEnabled: false,
              loggingEnabled: true,
              level,
            }),
          }
        : {}),
    });
    const log = native
      ? createApplicationLogger({ native, diagnose })
      : undefined;
    await processJobs({
      client,
      signal: options.signal,
      log,
      execute: async (job, signal) => {
        current = job;
        const run = await workflow.createRun();
        if (signal.aborted) {
          return;
        }
        let cancellation: Promise<void> | undefined;
        const cancel = () => {
          cancellation ??= run.cancel().catch(() => {
            diagnose("trace_shutdown_failed");
          });
        };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          log?.info("Ingestion job workflow started", {
            jobId: job.id,
            batchId: job.batch_id,
            eventId: job.event_id,
            engineRunId: run.runId,
          });
          const output = await run.start({
            inputData: {
              mode: "refresh",
              eventId: job.event_id,
              scope: job.scope,
              dryRun: Boolean(job.dry_run),
              republish: false,
            },
          });
          log?.info("Ingestion job workflow ended", {
            jobId: job.id,
            batchId: job.batch_id,
            eventId: job.event_id,
            engineRunId: run.runId,
            status: output.status,
            ...(output.status === "success"
              ? { ingestionRunId: output.result.ingestionRunId }
              : {}),
          });
        } finally {
          signal.removeEventListener("abort", cancel);
          await cancellation;
          current = undefined;
        }
      },
    });
  } finally {
    try {
      if (host) {
        await flushObservability(host, diagnose);
        await host.shutdown();
      } else if (storage) {
        await storage.close();
      } else {
        await observations?.close();
      }
    } finally {
      client.close();
    }
  }
}
