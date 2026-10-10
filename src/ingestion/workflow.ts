import { shrinkText, type ResearchLogger } from "./runtime/logging";
import type { CatalogOperation } from "@/catalog/operations/operation";
import { RESEARCH_PROMPT_VERSION } from "./research/contracts";
import { noopLogger } from "@mastra/core/logger";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import { createCatalogRunTrace, readInitialWithTrace } from "./runtime/tracing";
import { createResearchBudget } from "./runtime/budget";
import { loadResearchConfig } from "./runtime/config";
import { loadResearchContext, type ResearchContext } from "./research/context";
import { createSourceSession, type SourceSession } from "./sources/session";
import { researchFestival, type ResearchExecution } from "./research/agent";
import { prepareResearch } from "./research/prepare";
import type { ResearchError, ResearchQuestion } from "./research/contracts";
import {
  buildResearchReport,
  buildWorkflowFailureReport,
  type ReportInput,
} from "./report";
import {
  validateRunInvocation,
  storedRunInput,
  startIngestionRun,
  finalizeIngestionRun,
  RunPersistenceError,
} from "./runs";

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

// Step results are safe projections. Live resources and the full report stay in
// this invocation's closure and never enter Mastra's workflow state.
const runSchema = z.object({ runId: z.uuid() });
const contextSchema = runSchema.extend({
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
const resultSchema = runSchema.extend({
  outcome: z.enum([
    "created",
    "updated",
    "published",
    "unchanged",
    "skipped",
    "failed",
  ]),
});

/** Mastra must never receive original exceptions containing source or model data. */
async function safeStep<T>(execute: () => Promise<T> | T): Promise<T> {
  try {
    return await execute();
  } catch {
    throw new Error("Ingestion workflow failed");
  }
}

export async function runCatalogResearch(
  requested: CatalogResearchInput,
  deps: ResearchDependencies,
): Promise<CatalogResearchResult> {
  const validated = validateRunInvocation(
    deps.client,
    requested,
    deps.config ??
      (deps.generateCandidate
        ? {
            apiKey: "fixture",
            model: "fixture",
            limits: createResearchBudget().limits,
          }
        : loadResearchConfig()),
  );
  const { input, config } = validated;
  const budget = createResearchBudget({ ...config.limits, ...input.limits });
  const started = Date.now();
  const runId = startIngestionRun(
    deps.client,
    storedRunInput(input, config, budget.limits),
    started,
    input.mode === "add" ? null : input.eventId!,
  );
  const trace = await createCatalogRunTrace(
    input,
    config.model,
    runId,
    !!deps.generateCandidate,
    [
      deps.client.name,
      `${deps.client.name}-wal`,
      `${deps.client.name}-shm`,
      `${deps.client.name}-journal`,
      ...(deps.reportPath ? [deps.reportPath] : []),
    ],
  );
  const log = trace?.log;
  log?.info("Research started", {
    stage: "context",
    mode: input.mode,
    dryRun: input.dryRun,
    eventId: input.eventId,
    eventName: input.name,
    model: config.model,
    promptVersion: RESEARCH_PROMPT_VERSION,
  });
  let context: ResearchContext | null = null;
  let sources: SourceSession | null = null;
  let research: ResearchExecution = {
    ok: false,
    errors: [],
    usage: {
      complete: false,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: null,
      reasoningTokens: null,
      modelCostUsd: null,
    },
  };
  let prepared: ReturnType<typeof prepareResearch> | null = null;
  let applied: ReturnType<typeof applyCatalogItem> | null = null;
  let writeFailed = false;
  let errors: ResearchError[] = [];
  let unresolved: ResearchQuestion[] = [];
  const reportInput = (): ReportInput => ({
    runId,
    input,
    config,
    prepared,
    research,
    applied,
    writeFailed,
    errors,
    unresolved,
    reads: sources?.reads ?? [],
    discovery: sources?.discovery ?? [],
    budget: budget.snapshot(),
    started,
    finished: Date.now(),
  });
  let report: CatalogResearchResult | undefined;

  try {
    try {
      const loadContext = createStep({
        id: "load-context",
        description: "Load the target and known catalog sources",
        inputSchema: runSchema,
        outputSchema: contextSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(() => {
            context = loadResearchContext(deps.client, input);
            trace?.update({ context, phase: "initial_source" });
            return { ...inputData, knownLinkCount: context.knownLinks.length };
          }),
      });
      const readInitialSource = createStep({
        id: "read-initial-source",
        description: "Read the initial known source within the run budget",
        inputSchema: contextSchema,
        outputSchema: sourceSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(async () => {
            sources = createSourceSession(
              budget,
              config,
              context!.knownLinks,
              deps,
              log,
            );
            await readInitialWithTrace(sources, trace);
            return { ...inputData, readCount: sources.reads.length };
          }),
      });
      const runResearch = createStep({
        id: "research-festival",
        description: "Research the festival using bounded source tools",
        inputSchema: sourceSchema,
        outputSchema: researchSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(async () => {
            trace?.update({ phase: "research" });
            research = await researchFestival(
              input,
              context!,
              sources!,
              budget,
              config,
              deps,
              runId,
              trace?.tracing,
            );
            return {
              ...inputData,
              researchOk: research.ok,
              readCount: sources!.reads.length,
              searchCount: sources!.discovery.length,
            };
          }),
      });
      const prepareCandidate = createStep({
        id: "prepare-candidate",
        description: "Validate candidate facts and prepare catalog operations",
        inputSchema: researchSchema,
        outputSchema: preparedSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(() => {
            trace?.update({ phase: "validation" });
            if (research.ok) {
              prepared = prepareResearch(
                research.candidate,
                context!.catalog,
                input,
                context!.terms,
                budget.limits.pages,
              );
              trace?.tracing.setEventId(prepared.matchedEventId);
              trace?.validated(prepared);
              logPreparation(log, prepared);
              errors = prepared.errors;
              unresolved = prepared.unresolved;
            } else {
              errors = research.errors;
              trace?.failed("research_failed", false);
            }
            return {
              ...inputData,
              operationCount: prepared?.operations.length ?? 0,
            };
          }),
      });
      const applyItem = createStep({
        id: "apply-catalog-item",
        description: "Apply the item atomically or roll back a dry run",
        inputSchema: preparedSchema,
        outputSchema: appliedSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(() => {
            trace?.update({ phase: "write" });
            try {
              if (
                prepared?.candidate?.status !== "failed" &&
                prepared?.operations.length
              ) {
                if (trace) {
                  trace.state.writeState = "unknown";
                }
                applied = applyCatalogItem(deps.client, prepared.operations, {
                  dryRun: input.dryRun,
                });
                if (trace) {
                  trace.state.writeState = writeDisposition(input, applied);
                }
                trace?.tracing.setEventId(
                  reportEventId(input, prepared, applied),
                );
                trace?.update({ applied });
                log?.info("Catalog write finished", {
                  stage: "write",
                  dryRun: input.dryRun,
                  ...writeLogFields(input, applied, false),
                  fields: attemptedCatalogFields(prepared.operations),
                });
              }
            } catch {
              writeFailed = true;
              if (trace) {
                trace.state.writeState = "rolled_back";
              }
              trace?.failed("write_failed");
              errors.push({
                code: "write_failed",
                stage: "write",
                message: "Catalog write failed",
              });
            }
            return {
              ...inputData,
              changedCount:
                applied?.operations.filter((operation) => operation.changed)
                  .length ?? 0,
              writeFailed,
            };
          }),
      });
      const buildReport = createStep({
        id: "build-report",
        description: "Assemble the private run outcome and accounting",
        inputSchema: appliedSchema,
        outputSchema: resultSchema,
        retries: 0,
        execute: ({ inputData }) =>
          safeStep(() => {
            trace?.update({ phase: "report" });
            report = buildResearchReport(reportInput());
            return { runId: inputData.runId, outcome: report.outcome };
          }),
      });
      const workflow = createWorkflow({
        id: "catalog-ingestion",
        description: "Research and apply one festival catalog item",
        inputSchema: runSchema,
        outputSchema: resultSchema,
        retryConfig: { attempts: 0, delay: 0 },
        options: { shouldPersistSnapshot: () => false },
      })
        .then(loadContext)
        .then(readInitialSource)
        .then(runResearch)
        .then(prepareCandidate)
        .then(applyItem)
        .then(buildReport)
        .commit();
      workflow.__setLogger(noopLogger);

      const run = await workflow.createRun({
        runId,
        shouldPersistSnapshot: () => false,
      });
      const result = await run.start({ inputData: { runId } });
      if (result.status !== "success" || !report) {
        throw new Error("Ingestion workflow failed");
      }
    } catch {
      trace?.workflowFailed();
      errors = [
        ...errors,
        {
          code: "workflow_failed",
          stage: "workflow",
          message: "Ingestion workflow failed",
        },
      ];
      report = buildWorkflowFailureReport(reportInput());
    }
    // Writer transactions have finished. Persistence failure cannot re-enter workflow recovery.
    // Mastra step closures assign these values; TypeScript does not track those writes.
    const finalPrepared = prepared as ReturnType<typeof prepareResearch> | null;
    const finalApplied = applied as ReturnType<typeof applyCatalogItem> | null;
    let persistentEventId = input.eventId ?? null;
    if (input.mode === "add") {
      persistentEventId = finalPrepared?.matchedEventId ?? null;
      if (!input.dryRun) {
        persistentEventId ??= finalApplied?.references.event ?? null;
      }
    }
    try {
      const finalized = finalizeIngestionRun(
        deps.client,
        runId,
        report,
        persistentEventId,
        Date.now(),
      );
      logCompletion(
        log,
        finalized,
        input,
        finalPrepared,
        finalApplied,
        writeFailed,
      );
      return finalized;
    } catch (error) {
      if (error instanceof RunPersistenceError) {
        log?.error("Required run finalization failed", {
          stage: "report",
          errorCode: "run_persistence_failed",
          ...writeLogFields(input, finalApplied, writeFailed),
        });
      }
      throw error;
    }
  } finally {
    await trace?.finish(report);
  }
}

function logPreparation(
  log: ResearchLogger | undefined,
  prepared: ReturnType<typeof prepareResearch>,
) {
  const accepted = prepared.candidate && prepared.candidate.status !== "failed";
  log?.[accepted ? "info" : "warn"](
    accepted ? "Candidate prepared" : "Candidate rejected",
    {
      stage: "validation",
      status: prepared.candidate?.status ?? "invalid",
      eventId: prepared.matchedEventId,
      eventName: prepared.candidate?.data?.eventName,
      editions:
        prepared.candidate?.data?.editions.map((e) => ({
          editionKey: e.key,
          year: e.year?.value ?? null,
        })) ?? [],
      operationCount: prepared.operations.length,
      fields: attemptedCatalogFields(prepared.operations),
      validation: prepared.validation,
      errors: [...(prepared.validationIssues ?? []), ...prepared.errors].map(
        (error) => ({
          code: error.code,
          stage: error.stage,
          ...("message" in error
            ? { message: shrinkText(error.message, 512) }
            : { field: error.field }),
        }),
      ),
      unresolved: prepared.unresolved.map((q) => shrinkText(q.message, 512)),
      unresolvedOrigin: "model-reported",
    },
  );
}

function logCompletion(
  log: ResearchLogger | undefined,
  finalized: CatalogResearchResult,
  input: CatalogResearchInput,
  prepared: ReturnType<typeof prepareResearch> | null,
  applied: ReturnType<typeof applyCatalogItem> | null,
  writeFailed: boolean,
) {
  log?.[
    finalized.outcome === "failed" ||
    finalized.errors.some((error) => error.code === "workflow_failed")
      ? "error"
      : "info"
  ]("Research finished", {
    stage: "report",
    researchStatus: finalized.researchStatus,
    outcome: finalized.outcome,
    validation: prepared?.validation,
    ...writeLogFields(input, applied, writeFailed),
    errorCodes: finalized.errors.map((error) => error.code),
    mode: input.mode,
    dryRun: input.dryRun,
    eventId: finalized.eventId,
    durationMs: finalized.durationMs,
    usage: finalized.usage,
  });
}

function reportEventId(
  input: CatalogResearchInput,
  prepared: ReturnType<typeof prepareResearch> | null,
  applied: ReturnType<typeof applyCatalogItem> | null,
) {
  let persistentEventId = input.eventId ?? null;
  if (input.mode === "add") {
    persistentEventId = prepared?.matchedEventId ?? null;
    if (!input.dryRun) {
      persistentEventId ??= applied?.references.event ?? null;
    }
  }
  return persistentEventId;
}

function writeDisposition(
  input: CatalogResearchInput,
  applied: ReturnType<typeof applyCatalogItem>,
) {
  return !input.dryRun &&
    applied.operations.some((operation) => operation.changed)
    ? "committed"
    : "unchanged";
}

function attemptedCatalogFields(operations: CatalogOperation[]): string[] {
  return [
    ...new Set(
      operations.flatMap((operation) => {
        switch (operation.kind) {
          case "createEvent":
          case "updateEvent":
          case "createOccurrence":
          case "updateOccurrence":
            return Object.keys(operation.data);
          case "replaceLinks":
            return ["links"];
          case "replaceTerms":
            return ["termIds"];
          case "replacePriceBlock":
            return ["priceDetails", "basePrice"];
          default:
            return ["publicationState"];
        }
      }),
    ),
  ];
}

/** The same committed disposition is logged at write, finalization failure and completion. */
function writeLogFields(
  input: CatalogResearchInput,
  applied: ReturnType<typeof applyCatalogItem> | null,
  writeFailed: boolean,
) {
  let writeState = applied ? writeDisposition(input, applied) : "not_attempted";
  if (writeFailed) {
    writeState = "rolled_back";
  }
  return {
    writeState,
    committedOperationCount: input.dryRun
      ? 0
      : (applied?.operations.filter((operation) => operation.changed).length ??
        0),
  };
}
