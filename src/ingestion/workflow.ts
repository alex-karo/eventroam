import { studioIngestionInputSchema } from "./invocation";
import {
  studioIngestionResultSchema,
  type StudioIngestionResult,
} from "./workflow-result";
import { researchErrorSchema } from "./research/contracts";
import {
  specialistRoles,
  specialistStateSchema,
  type SpecialistRole,
} from "./specialist-results";
import { logPreparation } from "./workflow-logging";
import {
  collectSourceEvidence,
  readInitialSource,
} from "./research/collect-stage";
import {
  prepareSpecialistProposals,
  reviewPreparedProposals,
} from "./proposal-stages";
import { prepareCatalogPlan } from "./catalog-plan";
import { initialDiagnostics } from "./stage";
import { locationExecutionSchema } from "./roles/location/execution";
import { countryBaselineConflict } from "./research/guards";
import {
  runLocationBranch,
  runSpecialistBranch,
  selectGeneralTargets,
  workflowRoleOptions,
} from "./workflow-roles";
import { Mastra } from "@mastra/core/mastra";
import type { WorkflowsStorage } from "@mastra/core/storage";
import {
  pruneWorkflowSnapshot,
  WorkflowHistoryError,
} from "./runtime/workflow-storage";
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
import { loadResearchContext } from "./research/context";
import type {
  ReadPageResult,
  SourceReadMetadata,
} from "./tools/read-page/contracts";
import { writeCatalog } from "./catalog-write-stage";

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

export type StudioIngestionInput = z.input<typeof studioIngestionInputSchema>;

// Explicit fields expose research data; runtime resources are never included.
const dataSchema = z.object({
  context: z.json().nullable(),
  reads: z.array(z.json()),
  discovery: z.array(z.json()),
  research: z.json(),
  general: z.json(),
  specialists: specialistStateSchema,
  corpus: z.json().nullable(),
  prepared: z.json().nullable(),
  editor: z.json(),
  location: locationExecutionSchema,
  researchValidation: z.json().nullable(),
  editorValidation: z.json().nullable(),
  catalogPreparation: z.json().nullable(),
  outcome: z
    .enum(["created", "updated", "published", "unchanged", "skipped", "failed"])
    .nullable(),
  applied: z.json().nullable(),
  errors: z.array(researchErrorSchema),
  unresolved: z.array(z.json()),
  report: z.json().nullable(),
}) as unknown as z.ZodType<IngestionData>;
// State is initialized internally. A broad JSON master schema avoids advertising
// caller-editable state fields in Studio; each step validates the concrete data.
const stateSchema = z.object({}).catchall(z.json()) as unknown as z.ZodType<{
  data?: IngestionData;
}>;
const stepStateSchema = z.object({ data: dataSchema });
const stepSchema = z.json();
export type ResolvedCatalogDependencies = {
  deps: ResearchDependencies;
  close?: () => unknown | Promise<unknown>;
};
export type ResolveCatalogDependencies = (
  input: StudioIngestionInput,
  engineRunId: string,
) => Promise<ResolvedCatalogDependencies>;

/** A safe engine error has no original error as its cause. */
async function safeStep<T>(execute: () => T | Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof WorkflowHistoryError) {
      throw error;
    }
    throw new Error("Ingestion workflow failed");
  }
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sourceReadMetadata(read: ReadPageResult): SourceReadMetadata {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    method: read.method,
    status: read.status,
    reasonCode: read.reasonCode,
    httpStatus: read.httpStatus,
  };
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
  } catch (error) {
    if (abortSignal.aborted && error === abortSignal.reason) {
      // Let the phase save its source state before the engine ends cancellation.
      await owned.finalizeFailure(data, true);
      return null;
    }
    await owned.settle();
    if (owned.collection && !data.corpus) {
      data.corpus = await owned.collection.freeze();
    }
    await safeStep(() => owned.fail(data));
    return null;
  }
}

function projectSummary(
  owned: CatalogAttempt,
  result: CatalogResearchResult,
  persistenceStatus: "completed" | "failed",
): StudioIngestionResult {
  const errorCodes = result.errors.map((error) => error.code);
  return {
    engineRunId: owned.engineRunId,
    ingestionRunId: owned.ingestionRunId,
    mode: result.mode,
    dryRun: owned.input.dryRun ?? true,
    outcome: result.outcome,
    researchStatus: result.researchStatus,
    editorStatus: result.editorStatus,
    persistenceStatus,
    eventId: result.eventId ?? null,
    scope: result.scope,
    locationStatus: result.locationStatus,
    errorCodes:
      persistenceStatus === "failed"
        ? [
            ...errorCodes
              .filter((code) => code !== "run_persistence_failed")
              .slice(0, 19),
            "run_persistence_failed",
          ]
        : errorCodes,
  };
}

type InProcessInvocation = {
  requested: CatalogResearchInput;
  owned?: CatalogAttempt;
  historyFailed?: boolean;
};

export function createCatalogIngestionWorkflow(
  resolveDependencies: ResolveCatalogDependencies,
  options: { inProcess?: InProcessInvocation } = {},
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
      if (!owned.finalization) {
        await owned.finalizeFailure(data, cancelled);
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
        const owned = attempt(runId);
        return { engineRunId: runId, ingestionRunId: owned.ingestionRunId };
      }),
  });
  const phase = (
    id: string,
    description: string,
    execute: (
      owned: CatalogAttempt,
      data: IngestionData,
      signal: AbortSignal,
      inputData?: unknown,
    ) => unknown | Promise<unknown>,
  ) =>
    createStep({
      id,
      description,
      inputSchema: stepSchema,
      outputSchema: stepSchema,
      retries: 0,
      stateSchema: stepStateSchema,
      execute: async ({ runId, state, setState, abortSignal, inputData }) => {
        const owned = attempt(runId);
        const data = structuredClone(state.data);
        const output = await safePhase(
          owned,
          data,
          async () => {
            try {
              return await execute(owned, data, abortSignal, inputData);
            } finally {
              // Capture requests even when a phase fails or is cancelled,
              // before failure finalization reads the source history.
              if (owned.sources) {
                data.reads = owned.sources.reads.map(sourceReadMetadata);
                data.discovery = owned.sources.discovery;
              }
            }
          },
          abortSignal,
        );
        try {
          await setState({ data: serialize(data) });
          return serialize(output ?? null) as z.infer<typeof stepSchema>;
        } catch (error) {
          // Unserializable state cannot replace the last completed native state.
          await owned.finalizeFailure(
            data,
            abortSignal.aborted && error === abortSignal.reason,
          );
          throw new Error("Ingestion workflow failed");
        }
      },
    });
  const loadContext = phase(
    "load-context",
    "Load the target and known catalog sources",
    (owned, data) => {
      data.context = loadResearchContext(
        owned.deps.client,
        owned.input,
        owned.deps.todayUtc
          ? `${owned.deps.todayUtc}T12:00:00.000Z`
          : new Date(owned.started).toISOString(),
      );
      if (data.context.inputDuplicate) {
        const match = data.context.inputDuplicate;
        owned.trace?.setEventName(match.matchedName);
        data.researchValidation = {
          status: "skip",
          diagnostics: {
            ...initialDiagnostics(),
            matchedEventId: match.eventId,
            validation: { structural: "passed", target: "not_run" },
          },
        };
        data.outcome = "skipped";
        data.report = owned.buildReport(data);
        return data.context;
      }
      if (owned.input.mode === "refresh") {
        owned.trace?.setEventName(data.context.catalog[0].canonicalName);
        const saved = data.context.catalog[0].editions;
        const conflicting = countryBaselineConflict(saved);
        if (conflicting) {
          data.errors = [
            {
              code: "country_baseline_conflict",
              stage: "validation",
              message: "Saved Edition countries conflict",
            },
          ];
          data.outcome = "failed";
          data.report = owned.buildReport(data);
          return data.context;
        }
      }

      return data.context;
    },
  );
  const readInitial = phase(
    "read-initial-source",
    "Save and inspect the initial official source",
    readInitialSource,
  );
  const research = phase(
    "collect-sources",
    "Navigate sources, finish collection and freeze evidence",
    collectSourceEvidence,
  );
  const general = phase(
    "general-facts",
    "Confirm identity and select Edition targets",
    selectGeneralTargets,
  );
  // Each branch returns a result without replacing shared state.
  const specialist = (role: SpecialistRole) =>
    createStep({
      id: role,
      inputSchema: stepSchema,
      outputSchema: stepSchema,
      retries: 0,
      stateSchema: stepStateSchema,
      execute: async ({ runId, state, abortSignal }) => {
        const owned = attempt(runId);
        return role === "location"
          ? runLocationBranch(owned, state.data, abortSignal)
          : runSpecialistBranch(role, owned, state.data, abortSignal);
      },
    });
  const join = phase(
    "assemble-proposals",
    "Validate fixed proposals and return field errors to their owners",
    prepareSpecialistProposals,
  );
  const edit = phase(
    "review-proposals",
    "Review proposals and return disputed groups to their owners",
    (owned, data, signal) =>
      reviewPreparedProposals(
        owned,
        data,
        workflowRoleOptions(owned, data, signal),
      ),
  );
  const prepareOperations = phase(
    "prepare-catalog-plan",
    "Prepare operations from approved proposals",
    (owned, data) => {
      if (
        data.editorValidation?.status !== "continue" ||
        data.outcome === "failed"
      ) {
        return null;
      }
      const accepted = data.editorValidation.value;
      data.catalogPreparation = prepareCatalogPlan(
        accepted,
        data.context!.catalog,
        owned.input,
        data.context!.terms,
      );
      logPreparation(
        owned.trace?.log,
        data.catalogPreparation,
        accepted.targets,
      );
      if (data.catalogPreparation.status !== "continue") {
        data.outcome = "failed";
        data.errors.push(...data.catalogPreparation.diagnostics.errors);
      }
      return data.catalogPreparation;
    },
  );
  const apply = phase(
    "apply-catalog-item",
    "Apply the item atomically or roll back a dry run",
    writeCatalog,
  );
  const buildReport = phase(
    "build-report",
    "Assemble the outcome and diagnostics",
    (owned, data) => {
      data.report = owned.buildReport(data);
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
    execute: async ({ runId, state }) => {
      const owned = attempt(runId);
      const data = structuredClone(state.data);
      try {
        const result = await owned.finalize(data);
        return projectSummary(owned, result, "completed");
      } catch {
        if (data.report) {
          const summary = projectSummary(owned, data.report, "failed");
          throw new Error(
            JSON.stringify({ code: "run_persistence_failed", summary }),
          );
        }
        throw new Error("Ingestion workflow failed");
      } finally {
        await release(runId, owned, data.report ?? undefined);
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
      shouldPersistSnapshot: () => true,
      pruneSnapshot: ({ snapshot }) => pruneWorkflowSnapshot(snapshot),
      onStart: async ({ runId, getInitData, mastra }) => {
        if (attempts.has(runId)) {
          throw new Error("Ingestion attempt already active");
        }
        attempts.set(runId, null);
        try {
          const parsed = getInitData() as z.output<
            typeof studioIngestionInputSchema
          >;
          const store = await mastra?.getStorage()?.getStore("workflows");
          if (!store) {
            throw new WorkflowHistoryError(runId);
          }
          const saved = await checkSavedId(store, runId);
          if (!saved) {
            throw new WorkflowHistoryError(runId);
          }
          await store.persistWorkflowSnapshot({
            workflowName: "catalog-ingestion",
            runId,
            snapshot: pruneWorkflowSnapshot({
              ...saved,
              status: "running",
              context: {
                ...saved.context,
                input: parsed,
              } as unknown as typeof saved.context,
              timestamp: Date.now(),
            }),
          });
          const resolved = await resolveDependencies(parsed, runId);
          let owned: CatalogAttempt;
          try {
            const { input, ...settings } = parsed;
            owned = new CatalogAttempt(
              runId,
              options.inProcess?.requested ?? {
                ...settings,
                ...(typeof input === "string" ? { input } : input),
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
          if (options.inProcess) {
            options.inProcess.owned = owned;
          }
          await owned.initialize();
        } catch (error) {
          if (attempts.get(runId)) {
            await recover(runId, createIngestionData());
          } else {
            attempts.delete(runId);
          }
          if (options.inProcess || error instanceof WorkflowHistoryError) {
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
    .then(general)
    .parallel(specialistRoles.map(specialist))
    .then(join)
    .then(edit)
    .then(prepareOperations)
    .then(apply)
    .then(buildReport)
    .then(finalize)
    .commit();
  async function checkSavedId(store: WorkflowsStorage, runId: string) {
    const saved = await store.loadWorkflowSnapshot({
      workflowName: "catalog-ingestion",
      runId,
    });
    if (saved && saved.status !== "pending") {
      throw new Error("Ingestion execution already started");
    }
    return saved;
  }
  const historyControl = {
    activeCount: () => attempts.size,
    async assertCanStart(store: WorkflowsStorage, runId: string) {
      if (attempts.has(runId)) {
        throw new Error("Ingestion attempt already active");
      }
      await checkSavedId(store, runId);
    },
    async recoverHistory(runId: string, data = createIngestionData()) {
      if (options.inProcess) {
        options.inProcess.historyFailed = true;
      }
      await recover(runId, structuredClone(data));
    },
  };
  workflow.__setLogger(noopLogger);
  return Object.assign(workflow, { historyControl });
}

export async function runCatalogResearch(
  requested: CatalogResearchInput,
  deps: ResearchDependencies &
    Required<Pick<ResearchDependencies, "workflowStorage">>,
): Promise<CatalogResearchResult> {
  const invocation: InProcessInvocation = { requested };
  const workflow = createCatalogIngestionWorkflow(async () => ({ deps }), {
    inProcess: invocation,
  });
  const storage = deps.workflowStorage;
  storage.setFailureHandler(workflow.historyControl.recoverHistory);
  let host: Mastra | undefined;
  try {
    await storage.init();
    host = new Mastra({
      workflows: { "catalog-ingestion": workflow },
      storage,
      logger: false,
      loggerOptions: { export: false },
    });
    const run = await safeStep(() => workflow.createRun());
    const inputData = studioIngestionInputSchema.parse({
      mode: requested.mode,
      input:
        requested.mode === "refresh"
          ? { eventId: requested.eventId, scope: requested.scope }
          : requested.input,
      dryRun: requested.dryRun,
      republish: requested.republish,
    });
    const result = await run.start({ inputData }).catch((error: unknown) => {
      if (!invocation.owned || error instanceof WorkflowHistoryError) {
        throw error;
      }
      return undefined;
    });
    const owned = invocation.owned;
    if (!owned) {
      throw new Error("Ingestion attempt unavailable");
    }
    if (invocation.historyFailed) {
      throw new WorkflowHistoryError(run.runId);
    }
    if (owned.finalization) {
      return await owned.finalization;
    }
    throw new Error(
      result?.status === "success"
        ? "Ingestion result unavailable"
        : "Ingestion workflow failed",
    );
  } catch (error) {
    if (error instanceof WorkflowHistoryError || invocation.historyFailed) {
      const owned = invocation.owned;
      const report = await owned?.finalization?.catch(() => undefined);
      throw new WorkflowHistoryError(
        owned?.engineRunId ??
          (error instanceof WorkflowHistoryError
            ? error.engineRunId
            : undefined),
        owned?.ingestionRunId,
        report,
      );
    }
    throw error;
  } finally {
    // The caller owns the store; this run owns its host hooks.
    host?.__unregisterHooks();
  }
}
