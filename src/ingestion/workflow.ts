import { locationExecutionSchema } from "./location/execution";
import { resolveLocation } from "./location/agent";
import { buildLocationInput } from "./location/input";
import { assertLocationDonors } from "./location/donor-guard";
import {
  assertRefreshBaseline,
  countryBaselineConflict,
} from "./research/guards";
import { Mastra } from "@mastra/core/mastra";
import type { WorkflowsStorage } from "@mastra/core/storage";
import {
  createWorkflowStorage,
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
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import { loadResearchContext } from "./research/context";
import { createSourceSession } from "./tools/session";
import type {
  ReadPageResult,
  SourceReadMetadata,
} from "./tools/read-page/contracts";
import { readInitialWithTrace } from "./runtime/tracing";
import { researchFestival } from "./research/agent";
import {
  prepareEditorPlan,
  prepareCatalogPlan,
  validateResearch,
} from "./editor/prepare";
import { editResearch } from "./editor/agent";
import { readyCatalogPlan, catalogWriteOutcome } from "./pipeline";
import { stageDiagnostics } from "./editor/prepare";
import { buildResearchReport } from "./report";
import {
  logPreparation,
  reportEventId,
  attemptedCatalogFields,
} from "./workflow-logging";

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

export const studioIngestionInputSchema = z
  .strictObject({
    mode: z.enum(["add", "refresh"]),
    scope: z.enum(["full", "current"]).optional(),
    name: z.string().trim().min(1).max(500).optional(),
    eventId: z.string().trim().min(1).max(500).optional(),
    dryRun: z.boolean().default(true),
    republish: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (
      value.mode === "add" &&
      (!value.name || value.eventId || value.scope !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "add requires a name and no Event ID",
      });
    }
    if (value.mode !== "add" && (!value.eventId || value.name)) {
      context.addIssue({
        code: "custom",
        message: "refresh requires an Event ID and no name",
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
  editor: z.json(),
  location: locationExecutionSchema,
  researchValidation: z.json().nullable(),
  editorValidation: z.json().nullable(),
  catalogPreparation: z.json().nullable(),
  outcome: z
    .enum(["created", "updated", "published", "unchanged", "skipped", "failed"])
    .nullable(),
  applied: z.json().nullable(),
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
const stepSchema = z.json();
export const studioIngestionResultSchema = z.strictObject({
  engineRunId: z.string(),
  ingestionRunId: z.string(),
  mode: z.enum(["add", "refresh"]),
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
  editorStatus: z.enum(["success", "failed", "not_run"]),
  persistenceStatus: z.enum(["completed", "failed"]),
  eventId: z.string().nullable(),
  scope: z.enum(["full", "current"]).nullable(),
  savedEditionCount: z.number().int().nonnegative(),
  returnedEditionCount: z.number().int().nonnegative(),
  readCount: z.number().int().nonnegative(),
  searchCount: z.number().int().nonnegative(),
  operationCount: z.number().int().nonnegative(),
  changedCount: z.number().int().nonnegative(),
  locationStatus: locationExecutionSchema.shape.status,
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
  } catch {
    if (abortSignal.aborted) {
      // Failed steps discard buffered state updates in the installed engine.
      // Persist their local accounting before throwing; no private checkpoint.
      await owned.finalizeFailure(data, true);
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
    editorStatus: result.editorStatus,
    persistenceStatus,
    eventId: result.eventId ?? null,
    scope: result.scope,
    savedEditionCount: result.workload.savedEditions,
    returnedEditionCount: result.workload.returnedEditions,
    readCount: result.budget.pages,
    searchCount: result.budget.searches,
    operationCount: result.operations.length,
    changedCount: result.receipts.filter((receipt) => receipt.changed).length,
    locationStatus: result.locationStatus,
    errorCodes:
      persistenceStatus === "failed"
        ? [
            ...result.errors.map((error) => error.code),
            "run_persistence_failed",
          ]
        : result.errors.map((error) => error.code),
  };
}

type CliInvocation = {
  requested: CatalogResearchInput;
  deps: ResearchDependencies;
  owned?: CatalogAttempt;
  historyFailed?: boolean;
};

export function createCatalogIngestionWorkflow(
  resolveDependencies: ResolveCatalogDependencies,
  options: { cli?: CliInvocation } = {},
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
    ) => unknown | Promise<unknown>,
  ) =>
    createStep({
      id,
      description,
      inputSchema: stepSchema,
      outputSchema: stepSchema,
      retries: 0,
      stateSchema: stepStateSchema,
      execute: async ({ runId, state, setState, abortSignal }) => {
        const owned = attempt(runId);
        const data = structuredClone(state.data);
        const output = await safePhase(
          owned,
          data,
          async () => {
            try {
              return await execute(owned, data, abortSignal);
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
        } catch {
          // Unserializable state cannot replace the last completed native state.
          await owned.finalizeFailure(data, abortSignal.aborted);
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
      if (owned.input.mode === "refresh") {
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
          data.report = buildResearchReport(owned.reportInput(data));
          return data.context;
        }
      }

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
        { sessionId: owned.trace?.tracing.options.metadata.sessionId },
      );
      await owned.track(readInitialWithTrace(owned.sources, owned.trace));
      signal.throwIfAborted();
      return {
        reads: owned.sources.reads.map(sourceReadMetadata),
        discovery: owned.sources.discovery,
      };
    },
  );
  const research = phase(
    "research-festival",
    "Research the festival using bounded source tools",
    async (owned, data, signal) => {
      data.research = await owned.track(
        researchFestival(
          owned.input,
          data.context!,
          owned.sources!,
          owned.budget,
          owned.config,
          owned.deps,
          owned.trace?.tracing,
          signal,
          owned.capture,
        ),
      );
      return {
        research: data.research,
        reads: owned.sources!.reads.map(sourceReadMetadata),
        discovery: owned.sources!.discovery,
      };
    },
  );
  const validate = phase(
    "validate-research",
    "Validate research, target, scope and country before editing",
    (owned, data) => {
      if (data.research.ok) {
        data.researchValidation = validateResearch(
          data.research.candidate,
          data.context!.catalog,
          owned.input,
        );

        const diagnostics = stageDiagnostics(data.researchValidation);
        owned.trace?.tracing.setEventId(diagnostics.matchedEventId);
        data.errors = diagnostics.errors;
        data.unresolved = diagnostics.unresolved;
        if (data.researchValidation.status !== "continue") {
          data.outcome =
            data.researchValidation.status === "skip" ? "skipped" : "failed";
        }
      } else {
        data.errors = data.research.errors;
        data.outcome = "failed";
      }
      return data.researchValidation;
    },
  );
  const edit = phase(
    "edit-research",
    "Decide explicit field actions from research and saved state",
    async (owned, data, signal) => {
      if (data.researchValidation?.status !== "continue") {
        return data.editor;
      }

      data.editor = await owned.track(
        editResearch(
          data.researchValidation.value.candidate,
          owned.input,
          data.context!,
          owned.budget,
          owned.config,
          owned.deps,
          owned.trace?.tracing,
          signal,
        ),
      );
      data.errors.push(...data.editor.errors);
      if (data.editor.status !== "success") {
        data.outcome = "failed";
      }
      return data.editor;
    },
  );
  const prepare = phase(
    "validate-editor-plan",
    "Validate editorial actions before Location",
    (owned, data) => {
      if (
        data.editor.status !== "success" ||
        data.researchValidation?.status !== "continue"
      ) {
        return null;
      }

      data.editorValidation = prepareEditorPlan(
        data.editor.modelResponse?.object,
        data.researchValidation.value,
        data.context!.catalog,
        owned.input,
        data.context!.terms,
      );
      const diagnostics = stageDiagnostics(data.editorValidation);
      if (
        diagnostics.validationIssues?.some(
          (issue) => issue.code === "invalid_plan",
        )
      ) {
        data.editor.status = "failed";
      }
      data.errors = diagnostics.errors;
      data.unresolved = diagnostics.unresolved;
      if (data.editorValidation.status !== "continue") {
        data.outcome =
          data.editorValidation.status === "skip" ? "skipped" : "failed";
      }
      logPreparation(
        owned.trace?.log,
        data.editorValidation,
        data.researchValidation.value.candidate,
      );
      return data.editorValidation;
    },
  );
  const location = phase(
    "resolve-location",
    "Prepare geocoding and resolve the complete accepted place block",
    async (owned, data, signal) => {
      if (data.editorValidation?.status !== "continue") {
        return data.location;
      }
      const prepared = data.editorValidation.value;
      const hasTargets =
        prepared.editorPlan.previousEdition ||
        prepared.editorPlan.currentOrNextEdition;
      let materialized = {
        slots: {},
        donors: [],
        unresolved: [],
      } as NonNullable<IngestionData["location"]["materialized"]>;
      if (hasTargets) {
        const locationInput = buildLocationInput(
          prepared.editorPlan,
          prepared.candidate.data,
          data.context!,
          owned.input,
        );
        data.location = await owned.track(
          resolveLocation(
            locationInput,
            owned.budget,
            owned.config,
            owned.deps,
            owned.trace?.tracing,
            signal,
          ),
        );
        data.errors.push(...data.location.errors);
        if (data.location.status !== "success" || !data.location.materialized) {
          data.outcome = "failed";
          return data.location;
        }
        materialized = data.location.materialized;
      }
      data.catalogPreparation = prepareCatalogPlan(
        prepared,
        data.context!.catalog,
        owned.input,
        data.context!.terms,
        materialized,
      );
      const diagnostics = stageDiagnostics(data.catalogPreparation);
      data.errors = diagnostics.errors;
      data.unresolved = diagnostics.unresolved;
      if (data.catalogPreparation.status !== "continue") {
        data.outcome =
          data.catalogPreparation.status === "skip" ? "skipped" : "failed";
      }
      logPreparation(
        owned.trace?.log,
        data.catalogPreparation,
        prepared.candidate,
      );
      return data.location;
    },
  );
  const apply = phase(
    "apply-catalog-item",
    "Apply the item atomically or roll back a dry run",
    (owned, data, signal) => {
      signal.throwIfAborted();
      const plan = readyCatalogPlan(data);
      if (!plan) {
        return;
      }
      if (!plan.operations.length) {
        data.outcome = "unchanged";
        return;
      }
      try {
        data.applied = applyCatalogItem(owned.deps.client, plan.operations, {
          dryRun: owned.input.dryRun,
          beforeApply: (client) => {
            if (owned.input.mode === "refresh") {
              assertRefreshBaseline(
                client,
                owned.input.eventId!,
                data.context!.catalog[0].editions,
              );
            }
            assertLocationDonors(
              client,
              data.location.materialized?.donors ?? [],
            );
          },
        });
        data.outcome = catalogWriteOutcome(plan, data.applied);
        owned.trace?.tracing.setEventId(
          reportEventId(owned.input, plan, data.applied),
        );

        owned.trace?.log?.info("Catalog write finished", {
          stage: "write",
          dryRun: owned.input.dryRun,
          fields: attemptedCatalogFields(plan.operations),
        });
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        data.outcome = "failed";
        owned.trace?.failed("write_failed");
        data.errors.push({
          code: "write_failed",
          stage: "write",
          message: "Catalog write failed",
        });
      }
      return { applied: data.applied, outcome: data.outcome };
    },
  );
  const buildReport = phase(
    "build-report",
    "Assemble the outcome and diagnostics",
    (owned, data) => {
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
    execute: async ({ runId, state }) => {
      const owned = attempt(runId);
      const data = structuredClone(state.data);
      try {
        const result = await owned.finalize(data);
        return projectSummary(owned, result, "completed");
      } catch {
        if (data.report) {
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
          const resolved = options.cli
            ? { deps: options.cli.deps }
            : await resolveDependencies(parsed);
          let owned: CatalogAttempt;
          try {
            owned = new CatalogAttempt(
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
          if (options.cli) {
            options.cli.owned = owned;
          }
          await owned.initialize();
        } catch (error) {
          if (attempts.get(runId)) {
            await recover(runId, createIngestionData());
          } else {
            attempts.delete(runId);
          }
          if (options.cli || error instanceof WorkflowHistoryError) {
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
    .then(validate)
    .then(edit)
    .then(prepare)
    .then(location)
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
    async assertCanStart(store: WorkflowsStorage, runId: string) {
      if (attempts.has(runId)) {
        throw new Error("Ingestion attempt already active");
      }
      await checkSavedId(store, runId);
    },
    async recoverHistory(runId: string, data = createIngestionData()) {
      if (options.cli) {
        options.cli.historyFailed = true;
      }
      await recover(runId, structuredClone(data));
    },
  };
  workflow.__setLogger(noopLogger);
  return Object.assign(workflow, { historyControl });
}

export async function runCatalogResearch(
  requested: CatalogResearchInput,
  deps: ResearchDependencies,
): Promise<CatalogResearchResult> {
  const cli: CliInvocation = { requested, deps };
  const workflow = createCatalogIngestionWorkflow(async () => ({ deps }), {
    cli,
  });
  const storage =
    deps.workflowStorage ??
    createWorkflowStorage({ path: deps.workflowDatabasePath });
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
    const inputData = {
      mode: requested.mode,
      scope: requested.scope,
      name: requested.name,
      eventId: requested.eventId,
      dryRun: requested.dryRun ?? true,
      republish: requested.republish ?? false,
    };
    const result = await run.start({ inputData }).catch((error: unknown) => {
      if (!cli.owned || error instanceof WorkflowHistoryError) {
        throw error;
      }
      return undefined;
    });
    const owned = cli.owned;
    if (!owned) {
      throw new Error("Ingestion attempt unavailable");
    }
    if (cli.historyFailed) {
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
    if (error instanceof WorkflowHistoryError || cli.historyFailed) {
      const owned = cli.owned;
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
    if (deps.workflowStorage) {
      // The caller owns the store; this run owns its host hooks.
      host?.__unregisterHooks();
    } else if (host) {
      await host.shutdown();
    } else {
      await storage.close();
    }
  }
}
