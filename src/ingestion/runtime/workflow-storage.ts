import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { noopLogger } from "@mastra/core/logger";
import { MastraCompositeStore } from "@mastra/core/storage";
import type { WorkflowRunState } from "@mastra/core/workflows";
import { LibSQLStore } from "@mastra/libsql";
import type { DuckDBStore } from "@mastra/duckdb";
import type { CatalogResearchResult, IngestionData } from "../contracts";
import { workflowDatabasePath } from "./storage-paths";

export class WorkflowHistoryError extends Error {
  constructor(
    readonly engineRunId?: string,
    readonly runId?: string,
    readonly report?: CatalogResearchResult,
  ) {
    super("workflow_history_failed");
    this.name = "WorkflowHistoryError";
  }
}

export type HistoryFailure = (
  runId: string,
  data?: IngestionData,
) => Promise<void>;

/** The composite exposes native domains; the host owns their providers. */
export function createWorkflowStorage(
  options: {
    path?: string;
    observability?: DuckDBStore;
    onFailure?: HistoryFailure;
  } = {},
) {
  const path = options.path ?? workflowDatabasePath();
  let onFailure = options.onFailure;
  try {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    const provider = new LibSQLStore({
      id: "catalog-workflow-provider",
      url: path === ":memory:" ? path : pathToFileURL(path).href,
      // This adapter counts the first write as an attempt.
      maxRetries: 1,
    });
    provider.__setLogger(noopLogger);
    const workflows = provider.stores.workflows!;
    // LibSQL 1.25 captures its first logger in the write retry closure.
    // Silence that instance too, so storage errors cannot print raw content.
    Object.assign(Reflect.get(workflows, "logger"), {
      debug: noopLogger.debug,
      info: noopLogger.info,
      warn: noopLogger.warn,
      error: noopLogger.error,
    });
    workflows.__setLogger(noopLogger);
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async (args) => {
      try {
        await persist(args);
      } catch {
        try {
          await onFailure?.(
            args.runId,
            (args.snapshot.value as unknown as { data?: IngestionData })?.data,
          );
        } catch {
          // Preserve the history error if report finalization also fails.
        }
        throw new WorkflowHistoryError(args.runId);
      }
    };
    const load = workflows.loadWorkflowSnapshot.bind(workflows);
    workflows.loadWorkflowSnapshot = async (args) => {
      try {
        return await load(args);
      } catch {
        throw new WorkflowHistoryError(args.runId);
      }
    };
    workflows.getWorkflowRunById = safeStorageCall(
      workflows.getWorkflowRunById.bind(workflows),
    );
    workflows.listWorkflowRuns = safeStorageCall(
      workflows.listWorkflowRuns.bind(workflows),
    );
    workflows.deleteWorkflowRunById = safeStorageCall(
      workflows.deleteWorkflowRunById.bind(workflows),
    );
    return new (class extends MastraCompositeStore {
      constructor() {
        super({
          id: "catalog-workflow-storage",
          domains: {
            workflows,
            ...(options.observability
              ? { observability: options.observability.stores?.observability }
              : {}),
          },
        });
        this.__setLogger(noopLogger);
      }
      setFailureHandler(handler: HistoryFailure) {
        onFailure = handler;
      }
      override async init() {
        try {
          await super.init();
        } catch {
          throw new WorkflowHistoryError();
        }
      }
      override async close() {
        try {
          await super.close();
          await provider.close();
        } catch {
          throw new WorkflowHistoryError();
        } finally {
          try {
            await options.observability?.close();
          } catch {
            // Optional observations must not replace a durable outcome.
          }
        }
      }
    })();
  } catch {
    throw new WorkflowHistoryError();
  }
}

export function pruneWorkflowSnapshot(
  snapshot: WorkflowRunState,
): WorkflowRunState {
  const saved = { ...snapshot };
  delete saved.requestContext;
  return saved;
}

export type WorkflowStorage = ReturnType<typeof createWorkflowStorage>;

function safeStorageCall<Args extends unknown[], Result>(
  execute: (...args: Args) => Promise<Result>,
) {
  return async (...args: Args): Promise<Result> => {
    try {
      return await execute(...args);
    } catch {
      throw new WorkflowHistoryError();
    }
  };
}
