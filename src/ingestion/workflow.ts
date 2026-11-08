import { studioIngestionInputSchema } from "./invocation";
import {
  studioIngestionResultSchema,
  type StudioIngestionResult,
} from "./workflow-result";
import { researchErrorSchema } from "./research/contracts";
import {
  specialistResultsSchema,
  specialistStateSchema,
} from "./specialist-results";
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
  assembleProposals,
  applyReview,
  initialDiagnostics,
  type SpecialistOutputs,
} from "./proposals";
import { assignedGroups } from "./groups";
import { reviewPaths, reviewReturns, type ReviewDecisions } from "./review";
import { repairDiagnostic } from "./repairs";
import { prepareCatalogPlan } from "./catalog-plan";
import type { Targets } from "./roles/contracts";
import { stageDiagnostics } from "./stage";
import {
  emptyLocationExecution,
  locationExecutionSchema,
} from "./location/execution";
import { resolveLocation } from "./location/agent";
import { buildLocationInput } from "./location/input";
import { assertLocationPreviousPoints } from "./location/donor-guard";
import {
  assertRefreshBaseline,
  countryBaselineConflict,
  editionEligibility,
} from "./research/guards";
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

const specialistRoles = [
  "tickets",
  "classification",
  "location",
  "links",
] as const;
type SpecialistRole = (typeof specialistRoles)[number];

function specialistApplies(
  role: SpecialistRole,
  targets: Pick<Targets, "previousEdition" | "currentOrNextEdition">,
  scope: CatalogResearchInput["scope"],
) {
  if (role === "links" || (role === "classification" && scope !== "current")) {
    return true;
  }
  if (role === "tickets") {
    return !!targets.currentOrNextEdition;
  }
  return !!(targets.previousEdition || targets.currentOrNextEdition);
}

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
    capture: owned.repairs.capture,
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
        startedAt: owned.started,
        sources: owned.sources,
        budget: owned.budget,
        config: owned.config,
        deps: owned.deps,
        assignment: {
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
      data.unresolved.push(
        ...(data.research.output?.checks ?? []).flatMap((check) =>
          check.blocker
            ? [{ message: `${check.check}: ${check.blocker}` }]
            : [],
        ),
      );
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
        new Set(checks.map((check) => check.check)).size !== checks.length ||
        checks.some(
          (check) =>
            !assignment.checks.some(
              (assigned) => assigned.key === check.check,
            ) ||
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
      try {
        data.researchValidation =
          (await owned.track(owned.repairs.general(owned, data, signal))) ??
          null;
      } catch (error) {
        data.errors.push(repairDiagnostic(error));
        data.outcome = "failed";
        return data.general;
      }
      if (!data.researchValidation) {
        data.errors.push(...data.general.errors);
        data.outcome = "failed";
        return data.general;
      }
      const diagnostics = stageDiagnostics(data.researchValidation);
      const saved = data.context!.catalog.find(
        (event) => event.id === diagnostics.matchedEventId,
      );
      if (
        owned.input.mode === "add" &&
        data.researchValidation.status !== "reject" &&
        data.general.output &&
        data.general.output.decision !== "uncertain"
      ) {
        owned.trace?.setEventName(
          saved?.canonicalName ?? data.general.output.observedEventName,
        );
      }
      data.errors.push(...diagnostics.errors);
      data.unresolved.push(...diagnostics.unresolved);
      if (data.researchValidation.status !== "continue") {
        data.outcome =
          data.researchValidation.status === "skip" ? "skipped" : "failed";
      } else {
        const eligibility = editionEligibility(
          data.researchValidation.value,
          saved?.editions,
          owned.input.scope,
        );
        if (eligibility !== "continue") {
          data.outcome = eligibility;
        }
        if (eligibility === "skipped") {
          data.unresolved.push({
            field: "edition",
            message: "Insufficient information about editions",
          });
        }
      }
      return { execution: data.general, targets: data.researchValidation };
    },
  );
  // Branch steps return their own records. They do not race to replace shared state.
  const specialist = (role: SpecialistRole) =>
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
          data.outcome !== null ||
          !specialistApplies(role, targets, owned.input.scope)
        ) {
          if (role === "location") {
            return stepSchema.parse(emptyLocationExecution());
          }
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
                owned.repairs.captureLocation,
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
          return stepSchema.parse(await owned.track<unknown>(work()));
        } catch {
          if (role === "location") {
            return stepSchema.parse({
              ...emptyLocationExecution(),
              status: "failed",
              errors: [
                {
                  code: "location_failed",
                  stage: "location",
                  message: "Location branch failed",
                },
              ],
            });
          }
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
  function recordSpecialistOutputs(
    data: IngestionData,
    outputs: SpecialistOutputs,
  ) {
    for (const [role, output] of Object.entries(outputs)) {
      const execution = data.specialists[role];
      if (execution && output) {
        data.specialists[role] = {
          ...execution,
          status: "success",
          output,
          errors: [],
        };
      }
    }
  }

  function assemble(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets & import("./stage").PlanDiagnostics,
    outputs: SpecialistOutputs,
    originalTargets?: Targets,
  ) {
    const corpus = owned.repairs.corpus(data.corpus!);
    const rawLocation = owned.repairs.raw("location");
    if (rawLocation) {
      data.location.materialized = owned.repairs.materializeLocation(
        rawLocation,
        corpus.evidence,
      );
      data.location.status = "success";
      data.location.errors = [];
    }
    const oldQuestions =
      data.prepared?.status === "continue"
        ? data.prepared.value.unresolved
        : targets.unresolved;
    data.prepared = assembleProposals({
      targets,
      ...outputs,
      location: data.location.materialized ?? {
        support: {},
        slots: {},
        previousPoints: [],
        unresolved: [],
      },
      points: data.location.points,
      corpus,
      context: data.context!,
      input: owned.input,
      originalTargets,
    });
    if (data.prepared.status !== "continue") {
      data.outcome = "failed";
      data.errors.push(...data.prepared.diagnostics.errors);
    } else {
      data.unresolved = [
        ...data.unresolved.filter(
          (entry) =>
            !oldQuestions.some(
              (question) =>
                question.message === entry.message &&
                question.field === entry.field &&
                question.editionKey === entry.editionKey,
            ),
        ),
        ...data.prepared.value.unresolved,
      ];
    }
    return data.prepared;
  }

  const join = phase(
    "assemble-proposals",
    "Validate fixed proposals and return field errors to their owners",
    async (owned, data, signal, inputData) => {
      if (
        data.researchValidation?.status !== "continue" ||
        data.outcome !== null ||
        data.report
      ) {
        return null;
      }
      const parsed = specialistResultsSchema.safeParse(inputData);
      if (!parsed.success) {
        data.errors.push({
          code: "workflow_failed",
          stage: "workflow",
          message: "Specialist results are missing or invalid",
        });
        data.outcome = "failed";
        return null;
      }
      const results = parsed.data;
      const targets = data.researchValidation.value;
      for (const role of ["tickets", "classification", "links"] as const) {
        data.specialists[role] = results[role];
      }
      if (results.location.status !== "not_run") {
        data.location = results.location;
      }
      const firstQuestions = [
        ...(data.location.materialized?.unresolved ?? []),
        ...Object.values(results).flatMap((execution) =>
          "output" in execution ? execution.output.unresolved : [],
        ),
      ];
      for (const role of specialistRoles) {
        if (!specialistApplies(role, targets, owned.input.scope)) {
          continue;
        }
        const execution = results[role];
        if (
          execution.status === "rejected" ||
          (execution.status === "failed" &&
            (!owned.repairs.raw(role) ||
              execution.errors.some(({ code }) =>
                [
                  "model_failed",
                  "limit_reached",
                  "country_conflict",
                  "workflow_failed",
                ].includes(code),
              ))) ||
          execution.status === "not_run"
        ) {
          data.errors.push(...execution.errors);
          if (!execution.errors.length) {
            data.errors.push({
              code: "workflow_failed",
              stage: "workflow",
              message: `Missing assigned ${role} result`,
            });
          }
          data.outcome = "failed";
        }
      }
      if (data.outcome === "failed") {
        data.unresolved.push(...firstQuestions);
        return results;
      }
      try {
        const outputs = await owned.track(
          owned.repairs.beforeReview(owned, data, targets, signal),
        );
        recordSpecialistOutputs(data, outputs);
        return assemble(owned, data, targets, outputs);
      } catch (error) {
        data.errors.push(repairDiagnostic(error));
        data.unresolved.push(...firstQuestions);
        data.outcome = "failed";
        return results;
      }
    },
  );
  const edit = phase(
    "review-proposals",
    "Review proposals and return disputed groups to their owners",
    async (owned, data, signal) => {
      if (data.prepared?.status !== "continue" || data.outcome === "failed") {
        return null;
      }
      let prepared = data.prepared.value;
      const originalTargets = prepared.targets;
      const groups = assignedGroups(owned.input.scope, originalTargets);
      const runReview = (targeted?: Set<string>) =>
        owned.track(
          runEditor(
            {
              ...roleOptions(owned, data, signal),
              corpus: owned.repairs.corpus(data.corpus!),
            },
            prepared,
            reviewPaths(
              prepared,
              groups,
              owned.repairs.returnCounts,
              (owner) => owned.repairs.canReturn(owner),
              targeted,
            ),
            targeted
              ? owned.repairs.records.filter(({ path }) => targeted.has(path))
              : owned.repairs.records,
            !!targeted,
          ),
        );
      const execution = await runReview();
      data.specialists.editor = execution;
      data.editor = {
        status: execution.status,
        modelResponse: execution.modelResponse,
        errors: execution.errors,
      };
      if (execution.status !== "success" || !execution.output) {
        data.errors.push(...execution.errors);
        logPreparation(
          owned.trace?.log,
          {
            status: "reject",
            diagnostics: { ...initialDiagnostics(), errors: execution.errors },
          },
          originalTargets,
        );
        data.outcome = "failed";
        return execution;
      }
      const review: ReviewDecisions = new Map(
        execution.output.decisions.map((entry) => [entry.path, entry]),
      );
      for (
        let returned = reviewReturns(review);
        returned.length;
        returned = reviewReturns(review)
      ) {
        try {
          const firstRecord = owned.repairs.records.length;
          const outputs = await owned.track(
            owned.repairs.afterReview(
              owned,
              data,
              originalTargets,
              groups,
              returned,
              signal,
            ),
          );
          recordSpecialistOutputs(data, outputs);
          const general = owned.repairs.raw("general") as Targets;
          const revised = assemble(
            owned,
            data,
            {
              ...stageDiagnostics(data.researchValidation!),
              ...general,
            },
            outputs,
            originalTargets,
          );
          if (revised.status !== "continue") {
            return revised;
          }
          prepared = revised.value;
          const targeted = await runReview(
            new Set(returned.map(({ path }) => path)),
          );
          if (targeted.status !== "success" || !targeted.output) {
            data.errors.push(...targeted.errors);
            data.editor.status = "failed";
            data.editor.errors.push(...targeted.errors);
            data.outcome = "failed";
            for (const entry of owned.repairs.records.slice(firstRecord)) {
              entry.failure = targeted.errors[0];
            }
            return targeted;
          }
          for (const entry of targeted.output.decisions) {
            review.set(entry.path, entry);
          }
        } catch (error) {
          data.errors.push(repairDiagnostic(error));
          data.outcome = "failed";
          return null;
        }
      }
      for (const entry of owned.repairs.records) {
        entry.decision = review.get(entry.path);
      }
      signal.throwIfAborted();
      data.editorValidation = applyReview(prepared, review);
      logPreparation(owned.trace?.log, data.editorValidation, originalTargets);
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
