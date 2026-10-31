import { logPreparation } from "./workflow-logging";
import { createCollection } from "./evidence/collection";
import { buildAssignment } from "./roles/assignment";
import {
  collectResearch,
  runGeneral,
  runTickets,
  runClassification,
  runLinks,
  runEditor,
  type RoleOptions,
} from "./roles/run";
import {
  validateGeneral,
  assembleProposals,
  applyReview,
  initialDiagnostics,
} from "./proposals";
import { prepareCatalogPlan } from "./catalog-plan";
import type { RoleExecution } from "./roles/invoke";
import type {
  TicketsOutput,
  ClassificationOutput,
  LinksOutput,
} from "./roles/contracts";
import { stageDiagnostics } from "./stage";
import { locationExecutionSchema } from "./location/execution";
import { resolveLocation } from "./location/agent";
import { buildLocationInput } from "./location/input";
import { assertLocationPreviousPoints } from "./location/donor-guard";
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
import { readyCatalogPlan, catalogWriteOutcome } from "./pipeline";
import { buildResearchReport } from "./report";
import { reportEventId, attemptedCatalogFields } from "./workflow-logging";

function sourceErrorCode(source: { status: string; reasonCode?: string }) {
  if (source.status === "unsupported") {
    return "source_unsupported" as const;
  }
  return source.reasonCode?.includes("block")
    ? ("source_blocked" as const)
    : ("source_unavailable" as const);
}
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
  general: z.json(),
  specialists: z.json(),
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
  const roleOptions = (
    owned: CatalogAttempt,
    data: IngestionData,
    signal: AbortSignal,
  ): RoleOptions => ({
    input: owned.input,
    context: data.context!,
    corpus: data.corpus!,
    budget: owned.budget,
    config: owned.config,
    deps: owned.deps,
    signal,
    tracing: owned.trace?.tracing,
  });
  const readInitial = phase(
    "read-initial-source",
    "Save and inspect the initial official source",
    async (owned, data, signal) => {
      if (data.report) {
        return null;
      }
      owned.sources = createSourceSession(
        owned.budget,
        owned.config,
        data.context!.knownLinks,
        owned.deps,
        owned.trace?.log,
      );
      const assignment = buildAssignment(owned.input, data.context!);
      owned.collection = createCollection({
        runId: owned.ingestionRunId,
        sources: owned.sources,
        budget: owned.budget,
        config: owned.config,
        deps: owned.deps,
        assignment: {
          instructions: assignment.instructions,
          requestedName: assignment.identityContext.requestedName,
          currentDate: assignment.currentDate,
        },
        signal,
        tracing: owned.trace?.tracing,
      });
      if (owned.sources.initialUrl) {
        await owned.track(
          owned.collection.inspectPage(owned.sources.initialUrl),
        );
      }
      return { sources: owned.collection.sources };
    },
  );
  const research = phase(
    "collect-sources",
    "Navigate sources, finish collection and freeze evidence",
    async (owned, data, signal) => {
      if (data.report || !owned.collection) {
        return null;
      }
      try {
        data.research = await owned.track(
          collectResearch({
            ...roleOptions(owned, data, signal),
            collection: owned.collection,
            sourceSession: owned.sources!,
          }),
        );
      } finally {
        data.corpus = await owned.collection.freeze();
      }
      data.errors.push(...data.research.errors, ...owned.collection.errors);
      data.unresolved.push(...(data.research.output?.unresolved ?? []));
      if (
        owned.collection.fatal ||
        data.research.status !== "success" ||
        !data.corpus.evidence.length
      ) {
        data.outcome = "failed";
      }
      for (const source of data.corpus.sources) {
        if (source.status !== "ok") {
          data.errors.push({
            code: sourceErrorCode(source),
            stage: "source",
            url: source.attemptedUrl,
            message: `Source retrieval ${source.reasonCode ?? source.status}`,
          });
        }
      }
      const assignment = buildAssignment(owned.input, data.context!);
      const checks = data.research.output?.checks ?? [];
      if (
        checks.some(
          (check) =>
            !assignment.checks.some(
              (assigned) => assigned.key === check.check,
            ) ||
            check.evidenceIds.length ||
            check.sourceIds.some(
              (id) => !data.corpus!.sources.some((source) => source.id === id),
            ),
        )
      ) {
        data.errors.push({
          code: "invalid_candidate",
          stage: "validation",
          message: "Collection check references are invalid",
        });
        data.outcome = "failed";
      }
      return {
        collection: data.research,
        sources: data.corpus.sources,
        corpusVersion: data.corpus.version,
      };
    },
  );
  const general = phase(
    "general-facts",
    "Confirm identity and select Edition targets",
    async (owned, data, signal) => {
      if (data.report || data.outcome === "failed") {
        return null;
      }
      data.general = await owned.track(
        runGeneral(roleOptions(owned, data, signal)),
      );
      data.errors.push(...data.general.errors);
      if (!data.general.output) {
        data.outcome = "failed";
        return data.general;
      }
      data.researchValidation = validateGeneral(
        data.general.output,
        data.context!,
        owned.input,
        data.corpus!,
      );
      const diagnostics = stageDiagnostics(data.researchValidation);
      data.errors.push(...diagnostics.errors);
      data.unresolved.push(...diagnostics.unresolved);
      if (data.researchValidation.status !== "continue") {
        data.outcome =
          data.researchValidation.status === "skip" ? "skipped" : "failed";
      }
      return { execution: data.general, targets: data.researchValidation };
    },
  );
  // Branch steps return their own records. They do not race to replace shared state.
  const specialist = (
    role: "tickets" | "classification" | "links" | "location",
  ) =>
    createStep({
      id: role,
      inputSchema: stepSchema,
      outputSchema: stepSchema,
      retries: 0,
      stateSchema: stepStateSchema,
      execute: async ({ runId, state, abortSignal }) => {
        const owned = attempt(runId),
          data = state.data;
        const targets =
          data.researchValidation?.status === "continue"
            ? data.researchValidation.value
            : null;
        if (
          !targets ||
          data.report ||
          data.outcome === "failed" ||
          (role === "tickets" && !targets.currentOrNextEdition) ||
          (role !== "links" &&
            !targets.previousEdition &&
            !targets.currentOrNextEdition)
        ) {
          return {
            status: "not_run",
            skipReason: "No assigned target",
            modelResponse: null,
            errors: [],
            model: owned.config.model,
            promptVersion: role,
            durationMs: 0,
          };
        }
        const options = roleOptions(owned, data, abortSignal);
        try {
          const work = () => {
            if (role === "location") {
              return resolveLocation(
                buildLocationInput(
                  targets,
                  data.corpus!,
                  data.context!,
                  owned.input,
                ),
                owned.budget,
                owned.config,
                owned.deps,
                owned.trace?.tracing,
                abortSignal,
              );
            }
            if (role === "tickets") {
              return runTickets(options, targets);
            }
            if (role === "classification") {
              return runClassification(options, targets);
            }
            return runLinks(options, targets);
          };
          return (await owned.track<unknown>(work())) as z.infer<
            typeof stepSchema
          >;
        } catch {
          return {
            status: "failed",
            modelResponse: null,
            errors: [
              {
                code: "workflow_failed",
                stage: "workflow",
                message: `${role} branch failed`,
              },
            ],
            model: owned.config.model,
            promptVersion: role,
            durationMs: 0,
          };
        }
      },
    });
  const join = phase(
    "assemble-proposals",
    "Join independent results and validate fixed proposals",
    (owned, data, _signal, inputData) => {
      if (
        data.researchValidation?.status !== "continue" ||
        data.outcome === "failed" ||
        data.report
      ) {
        return null;
      }
      const results = inputData as Record<string, RoleExecution>;
      for (const role of ["tickets", "classification", "links"]) {
        data.specialists[role] = results[role];
      }
      if (results.location.status !== "not_run") {
        data.location =
          results.location as unknown as IngestionData["location"];
      }
      for (const result of Object.values(results)) {
        const output = result.output as
          | {
              checks?: import("./roles/contracts").CollectionOutput["checks"];
              unresolved?: import("./research/contracts").ResearchQuestion[];
            }
          | undefined;
        if (!output) {
          continue;
        }
        data.unresolved.push(...(output.unresolved ?? []));
        if (
          output.checks?.some(
            (check) =>
              check.evidenceIds.some(
                (id) => !data.corpus!.evidence.some((item) => item.id === id),
              ) ||
              check.sourceIds.some(
                (id) =>
                  !data.corpus!.sources.some((source) => source.id === id),
              ),
          )
        ) {
          data.errors.push({
            code: "invalid_candidate",
            stage: "validation",
            message: "Specialist check references are invalid",
          });
          data.outcome = "failed";
        }
      }
      data.unresolved.push(...(data.location.materialized?.unresolved ?? []));
      const errors = Object.values(results).flatMap((result) => result.errors);
      data.errors.push(...errors);
      if (
        data.outcome === "failed" ||
        Object.values(results).some(
          (result) =>
            result.status === "failed" ||
            (result.status as string) === "rejected",
        )
      ) {
        data.outcome = "failed";
        return results;
      }
      const targets = data.researchValidation.value;
      data.prepared = assembleProposals({
        targets,
        tickets: (results.tickets.output as TicketsOutput) ?? null,
        classification:
          (results.classification.output as ClassificationOutput) ?? null,
        links: results.links.output as LinksOutput,
        location: data.location.materialized ?? {
          support: {},
          slots: {},
          previousPoints: [],
          unresolved: [],
        },
        points: data.location.points,
        corpus: data.corpus!,
        context: data.context!,
        input: owned.input,
      });
      if (data.prepared.status !== "continue") {
        data.outcome = "failed";
        data.errors.push(...data.prepared.diagnostics.errors);
      }
      return data.prepared;
    },
  );
  const edit = phase(
    "review-proposals",
    "Approve or reject fixed proposal groups",
    async (owned, data, signal) => {
      if (data.prepared?.status !== "continue" || data.outcome === "failed") {
        return null;
      }
      const execution = await owned.track(
        runEditor(roleOptions(owned, data, signal), data.prepared.value),
      );
      data.specialists.editor = execution;
      data.editor = {
        status: execution.status,
        modelResponse: execution.modelResponse,
        errors: execution.errors,
      };
      data.errors.push(...execution.errors);
      if (execution.status !== "success") {
        logPreparation(
          owned.trace?.log,
          {
            status: "reject",
            diagnostics: { ...initialDiagnostics(), errors: execution.errors },
          },
          data.prepared.value.targets,
        );
        data.outcome = "failed";
        return execution;
      }
      data.unresolved.push(
        ...((
          execution.output as {
            unresolved?: import("./research/contracts").ResearchQuestion[];
          }
        ).unresolved ?? []),
      );
      data.editorValidation = applyReview(
        data.prepared.value,
        execution.output,
      );
      logPreparation(
        owned.trace?.log,
        data.editorValidation,
        data.prepared.value.targets,
      );
      if (data.editorValidation.status !== "continue") {
        data.outcome = "failed";
        data.errors.push(...data.editorValidation.diagnostics.errors);
      }
      return data.editorValidation;
    },
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
        accepted.location,
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
            assertLocationPreviousPoints(
              client,
              data.editorValidation?.status === "continue"
                ? data.editorValidation.value.location.previousPoints
                : [],
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
    .then(general)
    .parallel([
      specialist("tickets"),
      specialist("classification"),
      specialist("location"),
      specialist("links"),
    ])
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
