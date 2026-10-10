import { randomUUID } from "node:crypto";
import { noopLogger } from "@mastra/core/logger";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
  IngestionData,
} from "./contracts";
import { CatalogAttempt } from "./attempt";
import { createIngestionData } from "./contracts";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import { loadResearchContext } from "./research/context";
import { createSourceSession } from "./sources/session";
import { readInitialWithTrace } from "./runtime/tracing";
import { researchFestival } from "./research/agent";
import { prepareResearch } from "./research/prepare";
import { buildResearchReport } from "./report";
import {
  logPreparation,
  writeDisposition,
  reportEventId,
  writeLogFields,
  attemptedCatalogFields,
} from "./workflow-logging";

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

// Explicit fields expose research data; runtime resources are never included.
const dataSchema = z.object({
  context: z.json().nullable(),
  reads: z.array(z.json()),
  discovery: z.array(z.json()),
  research: z.json(),
  prepared: z.json().nullable(),
  applied: z.json().nullable(),
  writeFailed: z.boolean(),
  errors: z.array(z.json()),
  unresolved: z.array(z.json()),
  report: z.json().nullable(),
}) as unknown as z.ZodType<IngestionData>;
// State is initialized internally. A broad JSON master schema avoids advertising
// caller-editable state fields in Studio; each step validates the concrete data.
const stateSchema = z.object({}).catchall(z.json()) as unknown as z.ZodType<{
  data?: IngestionData;
}>;
const stepStateSchema = z.object({ data: dataSchema });
const stepSchema = z.object({ engineRunId: z.string(), output: z.json() });
export const studioIngestionResultSchema = z.strictObject({
  engineRunId: z.string(),
  ingestionRunId: z.string(),
  mode: z.enum(["add", "refresh", "check"]),
  dryRun: z.boolean(),
  outcome: z.enum([
    "created",
    "updated",
    "published",
    "unchanged",
    "skipped",
    "failed",
  ]),
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

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function finalizeFailure(
  owned: CatalogAttempt,
  data: IngestionData,
  cancelled = false,
) {
  await owned.settle();
  try {
    owned.fail(data, cancelled);
  } catch {
    /* Finalization records report failures. */
  }
  try {
    await owned.finalize(data);
  } catch {
    /* Preserve the engine's safe terminal error. */
  }
}

async function safePhase(
  owned: CatalogAttempt,
  data: IngestionData,
  execute: () => unknown | Promise<unknown>,
  abortSignal: AbortSignal,
) {
  if (data.report) {
    return null;
  }
  try {
    return await execute();
  } catch {
    if (abortSignal.aborted) {
      // Failed steps discard buffered state updates in the installed engine.
      // Persist their local accounting before throwing; no private checkpoint.
      await finalizeFailure(owned, data, true);
      throw new Error("Ingestion cancelled");
    }
    await safeStep(() => owned.fail(data));
    return null;
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
  const release = async (
    runId: string,
    owned: CatalogAttempt,
    report?: CatalogResearchResult,
  ) => {
    await owned.cleanup(report);
    if (attempts.get(runId) === owned) {
      attempts.delete(runId);
    }
  };
  const recover = async (
    runId: string,
    data: IngestionData,
    cancelled = false,
  ) => {
    const owned = attempts.get(runId);
    if (!owned) {
      return;
    }
    try {
      if (!owned.persistenceError && !owned.result) {
        await finalizeFailure(owned, data, cancelled);
      }
    } finally {
      await release(runId, owned, data.report ?? undefined);
    }
  };

  const initialize = createStep({
    id: "initialize-run",
    description: "Validate the target and create its durable run",
    inputSchema: studioIngestionInputSchema,
    outputSchema: stepSchema,
    retries: 0,
    stateSchema: stepStateSchema,
    execute: ({ runId, setState }) =>
      safeStep(async () => {
        await setState({ data: createIngestionData() });
        return { engineRunId: attempt(runId).engineRunId, output: null };
      }),
  });
  const phase = (
    id: string,
    description: string,
    execute: (
      owned: CatalogAttempt,
      data: IngestionData,
      signal: AbortSignal,
    ) => unknown | Promise<unknown>,
  ) =>
    createStep({
      id,
      description,
      inputSchema: stepSchema,
      outputSchema: stepSchema,
      retries: 0,
      stateSchema: stepStateSchema,
      execute: async ({ inputData, state, setState, abortSignal }) => {
        const owned = attempt(inputData.engineRunId);
        const data = structuredClone(state.data);
        const output = await safePhase(
          owned,
          data,
          () => execute(owned, data, abortSignal),
          abortSignal,
        );
        try {
          await setState({ data: serialize(data) });
          return {
            engineRunId: owned.engineRunId,
            output: serialize(output ?? null) as z.infer<
              ReturnType<typeof z.json>
            >,
          };
        } catch {
          // Unserializable state cannot replace the last completed native state.
          await finalizeFailure(owned, data, abortSignal.aborted);
          throw new Error("Ingestion workflow failed");
        }
      },
    });
  const loadContext = phase(
    "load-context",
    "Load the target and known catalog sources",
    (owned, data) => {
      data.context = loadResearchContext(owned.deps.client, owned.input);
      owned.trace?.update({ context: data.context, phase: "initial_source" });
      return data.context;
    },
  );
  const readInitial = phase(
    "read-initial-source",
    "Read the initial known source within the run budget",
    async (owned, data, signal) => {
      signal.throwIfAborted();
      owned.sources = createSourceSession(
        owned.budget,
        owned.config,
        data.context!.knownLinks,
        owned.deps,
        owned.trace?.log,
      );
      data.reads = owned.sources.reads;
      data.discovery = owned.sources.discovery;
      await owned.track(readInitialWithTrace(owned.sources, owned.trace));
      signal.throwIfAborted();
      return { reads: data.reads, discovery: data.discovery };
    },
  );
  const research = phase(
    "research-festival",
    "Research the festival using bounded source tools",
    async (owned, data, signal) => {
      data.reads = owned.sources!.reads;
      data.discovery = owned.sources!.discovery;
      owned.trace?.update({ phase: "research" });
      data.research = await owned.track(
        researchFestival(
          owned.input,
          data.context!,
          owned.sources!,
          owned.budget,
          owned.config,
          owned.deps,
          owned.ingestionRunId,
          owned.trace?.tracing,
          signal,
        ),
      );
      return {
        research: data.research,
        reads: data.reads,
        discovery: data.discovery,
      };
    },
  );
  const prepare = phase(
    "prepare-candidate",
    "Validate candidate facts and prepare catalog operations",
    (owned, data) => {
      owned.trace?.update({ phase: "validation" });
      if (data.research.ok) {
        data.prepared = prepareResearch(
          data.research.candidate,
          data.context!.catalog,
          owned.input,
          data.context!.terms,
        );
        owned.trace?.validated(data.prepared);
        owned.trace?.tracing.setEventId(data.prepared.matchedEventId);
        logPreparation(owned.trace?.log, data.prepared);
        data.errors = data.prepared.errors;
        data.unresolved = data.prepared.unresolved;
      } else {
        data.errors = data.research.errors;
        owned.trace?.failed("research_failed", false);
      }
      return data.prepared;
    },
  );
  const apply = phase(
    "apply-catalog-item",
    "Apply the item atomically or roll back a dry run",
    (owned, data, signal) => {
      owned.trace?.update({ phase: "write" });
      signal.throwIfAborted();
      if (
        !data.prepared?.operations.length ||
        data.prepared.candidate?.status === "failed"
      ) {
        return;
      }
      if (owned.trace) {
        owned.trace.state.writeState = "unknown";
      }
      try {
        data.applied = applyCatalogItem(
          owned.deps.client,
          data.prepared.operations,
          {
            dryRun: owned.input.dryRun,
          },
        );
        if (owned.trace) {
          owned.trace.state.writeState = writeDisposition(
            owned.input,
            data.applied,
          );
        }
        owned.trace?.tracing.setEventId(
          reportEventId(owned.input, data.prepared, data.applied),
        );
        owned.trace?.update({ applied: data.applied });
        owned.trace?.log?.info("Catalog write finished", {
          stage: "write",
          dryRun: owned.input.dryRun,
          ...writeLogFields(owned.input, data.applied, false),
          fields: attemptedCatalogFields(data.prepared.operations),
        });
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        data.writeFailed = true;
        if (owned.trace) {
          owned.trace.state.writeState = "rolled_back";
        }
        owned.trace?.failed("write_failed");
        data.errors.push({
          code: "write_failed",
          stage: "write",
          message: "Catalog write failed",
        });
      }
      return { applied: data.applied, writeFailed: data.writeFailed };
    },
  );
  const buildReport = phase(
    "build-report",
    "Assemble the outcome and accounting",
    (owned, data) => {
      owned.trace?.update({ phase: "report" });
      data.report = buildResearchReport(owned.reportInput(data));
      return data.report;
    },
  );
  const finalize = createStep({
    id: "finalize-run",
    description: "Persist the run and return a bounded summary",
    inputSchema: stepSchema,
    outputSchema: studioIngestionResultSchema,
    retries: 0,
    stateSchema: stepStateSchema,
    execute: async ({ inputData, state }) => {
      const owned = attempt(inputData.engineRunId);
      const data = structuredClone(state.data);
      try {
        const result = (await owned.finalize(data))!;
        return projectSummary(owned, result, "completed");
      } catch {
        if (owned.persistenceError && data.report) {
          const summary = projectSummary(owned, data.report, "failed");
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
        await release(inputData.engineRunId, owned, data.report ?? undefined);
      }
    },
  });

  const workflow = createWorkflow({
    id: "catalog-ingestion",
    description: "Research one festival catalog item",
    inputSchema: studioIngestionInputSchema,
    outputSchema: studioIngestionResultSchema,
    stateSchema,
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
            await recover(runId, createIngestionData());
          } else {
            attempts.delete(runId);
          }
          if (options.cli) {
            throw error;
          }
          throw new Error("Ingestion workflow failed");
        }
      },
      onFinish: async ({ runId, status, state }) => {
        if (status !== "success") {
          await recover(
            runId,
            structuredClone(state.data ?? createIngestionData()),
            status === "canceled",
          );
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
    const data = createIngestionData();
    owned.fail(data);
    return (await owned.finalize(data))!;
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
