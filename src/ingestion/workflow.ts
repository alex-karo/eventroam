import { randomUUID } from "node:crypto";
import { noopLogger } from "@mastra/core/logger";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import { CatalogAttempt } from "./attempt";

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

export const studioIngestionInputSchema = z
  .strictObject({
    mode: z.enum(["add", "refresh", "check"]),
    name: z.string().trim().min(1).max(500).optional(),
    eventId: z.string().trim().min(1).max(500).optional(),
    dryRun: z.boolean().default(true),
    republish: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.mode === "add" && (!value.name || value.eventId)) {
      context.addIssue({
        code: "custom",
        message: "add requires a name and no Event ID",
      });
    }
    if (value.mode !== "add" && (!value.eventId || value.name)) {
      context.addIssue({
        code: "custom",
        message: "refresh and check require an Event ID and no name",
      });
    }
  });
export type StudioIngestionInput = z.input<typeof studioIngestionInputSchema>;

const idSchema = z.object({ engineRunId: z.string() });
const contextSchema = idSchema.extend({
  knownLinkCount: z.number().int().nonnegative(),
});
const sourceSchema = contextSchema.extend({
  readCount: z.number().int().nonnegative(),
});
const researchSchema = sourceSchema.extend({
  researchOk: z.boolean(),
  searchCount: z.number().int().nonnegative(),
});
const preparedSchema = researchSchema.extend({
  operationCount: z.number().int().nonnegative(),
});
const appliedSchema = preparedSchema.extend({
  changedCount: z.number().int().nonnegative(),
  writeFailed: z.boolean(),
});
const reportSchema = appliedSchema.extend({
  outcome: z.enum([
    "created",
    "updated",
    "published",
    "unchanged",
    "skipped",
    "failed",
  ]),
});
export const studioIngestionResultSchema = z.strictObject({
  engineRunId: z.string(),
  ingestionRunId: z.string(),
  mode: z.enum(["add", "refresh", "check"]),
  dryRun: z.boolean(),
  outcome: reportSchema.shape.outcome,
  researchStatus: z.enum(["success", "partial", "failed"]),
  persistenceStatus: z.enum(["completed", "failed"]),
  eventId: z.string().nullable(),
  readCount: z.number().int().nonnegative(),
  searchCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  changedCount: z.number().int().nonnegative(),
  usage: z.strictObject({
    complete: z.boolean(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    modelCostUsd: z.number().nullable(),
    searchCostUsd: z.number(),
  }),
  errorCodes: z.array(z.string()),
});

export type ResolvedCatalogDependencies = {
  deps: ResearchDependencies;
  close?: () => unknown | Promise<unknown>;
};
export type ResolveCatalogDependencies = (
  input: StudioIngestionInput,
) => Promise<ResolvedCatalogDependencies>;

/** A safe engine error has no original error as its cause. */
async function safeStep<T>(execute: () => T | Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch {
    throw new Error("Ingestion workflow failed");
  }
}

async function safePhase<T>(
  owned: CatalogAttempt,
  execute: () => T | Promise<T>,
  fallback: () => T,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (owned.report) {
    return fallback();
  }
  try {
    return await execute();
  } catch {
    if (abortSignal?.aborted) {
      throw new Error("Ingestion cancelled");
    }
    try {
      owned.fail();
      return fallback();
    } catch {
      throw new Error("Ingestion workflow failed");
    }
  }
}

function projectSummary(
  owned: CatalogAttempt,
  result: CatalogResearchResult,
  persistenceStatus: "completed" | "failed",
) {
  return {
    engineRunId: owned.engineRunId,
    ingestionRunId: owned.ingestionRunId,
    mode: result.mode,
    dryRun: owned.input.dryRun ?? true,
    outcome: result.outcome,
    researchStatus: result.researchStatus,
    persistenceStatus,
    eventId: result.eventId ?? null,
    readCount: result.usage.pages,
    searchCount: result.usage.searches,
    operationCount: result.operations.length,
    changedCount: result.receipts.filter((receipt) => receipt.changed).length,
    usage: {
      complete: result.usage.complete,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      modelCostUsd: result.usage.modelCostUsd,
      searchCostUsd: result.usage.searchCostUsd,
    },
    errorCodes:
      persistenceStatus === "failed"
        ? [
            ...result.errors.map((error) => error.code),
            "run_persistence_failed",
          ]
        : result.errors.map((error) => error.code),
  };
}

export function createCatalogIngestionWorkflow(
  resolveDependencies: ResolveCatalogDependencies,
  options: {
    cli?: { requested: CatalogResearchInput; deps: ResearchDependencies };
    preparedAttempt?: CatalogAttempt;
    onAttempt?: (attempt: CatalogAttempt) => void;
  } = {},
) {
  const attempts = new Map<string, CatalogAttempt | null>();
  const attempt = (engineRunId: string) => {
    const owned = attempts.get(engineRunId);
    if (!owned) {
      throw new Error("Ingestion attempt unavailable");
    }
    return owned;
  };
  const release = async (runId: string, owned: CatalogAttempt) => {
    await owned.cleanup();
    if (attempts.get(runId) === owned) {
      attempts.delete(runId);
    }
  };
  const recover = async (runId: string, cancelled = false) => {
    const owned = attempts.get(runId);
    if (!owned) {
      return;
    }
    try {
      if (!owned.persistenceError && !owned.result) {
        await owned.settle();
        try {
          owned.fail(cancelled);
        } catch {
          /* Preserve safe terminal cleanup. */
        }
        try {
          await owned.finalize();
        } catch {
          /* Explicit finalization already records this. */
        }
      }
    } finally {
      await release(runId, owned);
    }
  };

  const initialize = createStep({
    id: "initialize-run",
    description: "Validate the target and create its durable run",
    inputSchema: studioIngestionInputSchema,
    outputSchema: idSchema,
    retries: 0,
    execute: ({ runId }) =>
      safeStep(() => ({ engineRunId: attempt(runId).engineRunId })),
  });
  const loadContext = createStep({
    id: "load-context",
    description: "Load the target and known catalog sources",
    inputSchema: idSchema,
    outputSchema: contextSchema,
    retries: 0,
    execute: ({ inputData }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        () => ({ ...inputData, knownLinkCount: owned.loadContext() }),
        () => ({ ...inputData, knownLinkCount: 0 }),
      );
    },
  });
  const readInitial = createStep({
    id: "read-initial-source",
    description: "Read the initial known source within the run budget",
    inputSchema: contextSchema,
    outputSchema: sourceSchema,
    retries: 0,
    execute: ({ inputData, abortSignal }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        async () => ({
          ...inputData,
          readCount: await owned.readInitial(abortSignal),
        }),
        () => ({ ...inputData, readCount: owned.sources?.reads.length ?? 0 }),
        abortSignal,
      );
    },
  });
  const research = createStep({
    id: "research-festival",
    description: "Research the festival using bounded source tools",
    inputSchema: sourceSchema,
    outputSchema: researchSchema,
    retries: 0,
    execute: ({ inputData, abortSignal }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        async () => {
          const researchOk = await owned.runResearch(abortSignal);
          return {
            ...inputData,
            researchOk,
            readCount: owned.sources?.reads.length ?? 0,
            searchCount: owned.sources?.discovery.length ?? 0,
          };
        },
        () => ({
          ...inputData,
          researchOk: false,
          readCount: owned.sources?.reads.length ?? 0,
          searchCount: owned.sources?.discovery.length ?? 0,
        }),
        abortSignal,
      );
    },
  });
  const prepare = createStep({
    id: "prepare-candidate",
    description: "Validate candidate facts and prepare catalog operations",
    inputSchema: researchSchema,
    outputSchema: preparedSchema,
    retries: 0,
    execute: ({ inputData }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        () => ({ ...inputData, operationCount: owned.prepare() }),
        () => ({
          ...inputData,
          operationCount: owned.prepared?.operations.length ?? 0,
        }),
      );
    },
  });
  const apply = createStep({
    id: "apply-catalog-item",
    description: "Apply the item atomically or roll back a dry run",
    inputSchema: preparedSchema,
    outputSchema: appliedSchema,
    retries: 0,
    execute: ({ inputData, abortSignal }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        () => ({ ...inputData, ...owned.apply(abortSignal) }),
        () => ({
          ...inputData,
          changedCount:
            owned.applied?.operations.filter((o) => o.changed).length ?? 0,
          writeFailed: owned.writeFailed,
        }),
        abortSignal,
      );
    },
  });
  const buildReport = createStep({
    id: "build-report",
    description: "Assemble the private outcome and accounting",
    inputSchema: appliedSchema,
    outputSchema: reportSchema,
    retries: 0,
    execute: ({ inputData }) => {
      const owned = attempt(inputData.engineRunId);
      return safePhase(
        owned,
        () => ({ ...inputData, outcome: owned.buildReport() }),
        () => ({ ...inputData, outcome: owned.report!.outcome }),
      );
    },
  });
  const finalize = createStep({
    id: "finalize-run",
    description: "Persist the run and return a bounded summary",
    inputSchema: reportSchema,
    outputSchema: studioIngestionResultSchema,
    retries: 0,
    execute: async ({ inputData }) => {
      const owned = attempt(inputData.engineRunId);
      try {
        const result = (await owned.finalize())!;
        return projectSummary(owned, result, "completed");
      } catch {
        if (owned.persistenceError && owned.report) {
          const summary = projectSummary(owned, owned.report, "failed");
          summary.errorCodes = [
            ...summary.errorCodes
              .filter((code) => code !== "run_persistence_failed")
              .slice(0, 19),
            "run_persistence_failed",
          ];
          throw new Error(
            JSON.stringify({ code: "run_persistence_failed", summary }),
          );
        }
        throw new Error("Ingestion workflow failed");
      } finally {
        await release(inputData.engineRunId, owned);
      }
    },
  });

  const workflow = createWorkflow({
    id: "catalog-ingestion",
    description: "Research one festival catalog item",
    inputSchema: studioIngestionInputSchema,
    outputSchema: studioIngestionResultSchema,
    retryConfig: { attempts: 0, delay: 0 },
    options: {
      validateInputs: true,
      autoRestartActiveRuns: false,
      shouldPersistSnapshot: () => false,
      onStart: async ({ runId, getInitData }) => {
        if (attempts.has(runId)) {
          throw new Error("Ingestion attempt already active");
        }
        attempts.set(runId, null);
        try {
          const parsed = studioIngestionInputSchema.parse(getInitData());
          const resolved = options.cli
            ? { deps: options.cli.deps }
            : await resolveDependencies(parsed);
          let owned: CatalogAttempt;
          try {
            owned =
              options.preparedAttempt ??
              new CatalogAttempt(
                runId,
                options.cli?.requested ?? {
                  ...parsed,
                  actor: "catalog-research",
                },
                resolved.deps,
                resolved.close,
              );
          } catch (error) {
            await resolved.close?.();
            throw error;
          }
          attempts.set(runId, owned);
          options.onAttempt?.(owned);
          if (!options.preparedAttempt) {
            await owned.initialize();
          }
        } catch (error) {
          if (attempts.get(runId)) {
            await recover(runId);
          } else {
            attempts.delete(runId);
          }
          if (options.cli) {
            throw error;
          }
          throw new Error("Ingestion workflow failed");
        }
      },
      onFinish: async ({ runId, status }) => {
        if (status !== "success") {
          await recover(runId, status === "canceled");
        }
      },
    },
  })
    .then(initialize)
    .then(loadContext)
    .then(readInitial)
    .then(research)
    .then(prepare)
    .then(apply)
    .then(buildReport)
    .then(finalize)
    .commit();
  workflow.__setLogger(noopLogger);
  return workflow;
}

export async function runCatalogResearch(
  requested: CatalogResearchInput,
  deps: ResearchDependencies,
): Promise<CatalogResearchResult> {
  const engineRunId = randomUUID();
  const owned = new CatalogAttempt(engineRunId, requested, deps);
  let run;
  try {
    await owned.initialize();
    const workflow = createCatalogIngestionWorkflow(async () => ({ deps }), {
      cli: { requested, deps },
      preparedAttempt: owned,
    });
    run = await workflow.createRun({
      runId: engineRunId,
      shouldPersistSnapshot: () => false,
    });
  } catch {
    owned.fail();
    return (await owned.finalize())!;
  }
  const inputData = {
    mode: requested.mode,
    name: requested.name,
    eventId: requested.eventId,
    dryRun: requested.dryRun ?? true,
    republish: requested.republish ?? false,
  };
  const result = await run.start({ inputData });
  if (owned.persistenceError) {
    throw owned.persistenceError;
  }
  if (owned.terminalError) {
    throw owned.terminalError;
  }
  if (owned.result) {
    return owned.result;
  }
  throw new Error(
    result.status === "success"
      ? "Ingestion result unavailable"
      : "Ingestion workflow failed",
  );
}
