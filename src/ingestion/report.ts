import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import type { ResearchBudgetSnapshot } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type {
  ReadSourceResult,
  DiscoverSourcesResult,
} from "./sources/contracts";
import {
  RESEARCH_PROMPT_VERSION,
  researchCandidateSchema,
  type ResearchError,
  type ResearchQuestion,
} from "./research/contracts";
import type { prepareResearch } from "./research/prepare";
import type { ResearchExecution } from "./research/agent";

export type ReportInput = {
  runId: string;
  input: CatalogResearchInput;
  config: ResearchConfig;
  prepared: ReturnType<typeof prepareResearch> | null;
  research: ResearchExecution;
  applied: ReturnType<typeof applyCatalogItem> | null;
  writeFailed: boolean;
  errors: ResearchError[];
  unresolved: ResearchQuestion[];
  reads: ReadSourceResult[];
  discovery: DiscoverSourcesResult[];
  budget: ResearchBudgetSnapshot;
  started: number;
  finished: number;
};

export function buildResearchReport(input: ReportInput): CatalogResearchResult {
  return assembleReport(input);
}

/** Uses the same accounting when the normal report boundary fails. */
export function buildWorkflowFailureReport(
  input: ReportInput,
): CatalogResearchResult {
  const report = assembleReport(input);
  if (!input.prepared && input.research.ok) {
    const candidate = researchCandidateSchema.safeParse(
      input.research.candidate,
    );
    if (candidate.success) {
      report.researchStatus = candidate.data.status;
    }
  }
  return report;
}

function assembleReport({
  runId,
  input,
  config,
  prepared,
  research,
  applied,
  writeFailed,
  errors,
  unresolved,
  reads,
  discovery,
  budget,
  started,
  finished,
}: ReportInput): CatalogResearchResult {
  const operations = prepared?.operations ?? [];
  const receipts = applied?.operations ?? [];
  const references = applied?.references ?? {};
  const changes = (applied?.changes ?? []).flatMap((change) =>
    change.changedFields.map((field) => ({
      subject: change.occurrenceId ?? change.eventId ?? "",
      field: field.field,
      oldValue: field.oldValue,
      newValue: field.newValue,
      explanations:
        prepared?.explanations[change.operationKey]?.[field.field] ?? [],
    })),
  );
  const researchStatus =
    !research.ok || !prepared?.candidate ? "failed" : prepared.candidate.status;
  const {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    modelCostUsd,
  } = research.usage;
  const usageComplete =
    research.usage.complete &&
    budget.searches === discovery.length &&
    discovery.every((result) => result.usageComplete !== false);
  const changedKinds = operations
    .filter((_, index) => receipts[index]?.changed)
    .map((operation) => operation.kind);
  return {
    schemaVersion: 2,
    runId,
    mode: input.mode,
    outcome: researchOutcome({
      changedKinds,
      writeFailed,
      researchStatus,
      skipped: prepared?.skipped ?? false,
    }),
    researchStatus,
    eventId: prepared?.matchedEventId ?? references.event ?? input.eventId,
    modelResponse: research.modelResponse ?? null,
    operations,
    receipts,
    references,
    changes,
    sources: reads.map(safeSource),
    sourceSummaries: prepared?.candidate?.data?.sources ?? [],
    errors,
    unresolved,
    eventNameMismatch: prepared?.eventNameMismatch ?? null,
    usage: {
      ...budget,
      complete: usageComplete,
      searchCostBasis: "estimate",
      inputTokens:
        inputTokens +
        discovery.reduce((sum, result) => sum + result.inputTokens, 0),
      outputTokens:
        outputTokens +
        discovery.reduce((sum, result) => sum + result.outputTokens, 0),
      cachedInputTokens:
        cachedInputTokens === null ||
        discovery.some((result) => result.cachedInputTokens == null)
          ? null
          : cachedInputTokens +
            discovery.reduce(
              (sum, result) => sum + (result.cachedInputTokens ?? 0),
              0,
            ),
      reasoningTokens:
        reasoningTokens === null ||
        discovery.some((result) => result.reasoningTokens == null)
          ? null
          : reasoningTokens +
            discovery.reduce(
              (sum, result) => sum + (result.reasoningTokens ?? 0),
              0,
            ),
      modelCostUsd:
        usageComplete &&
        modelCostUsd !== null &&
        discovery.every((result) => result.modelCostUsd !== null)
          ? modelCostUsd +
            discovery.reduce(
              (sum, result) => sum + (result.modelCostUsd ?? 0),
              0,
            )
          : null,
      searchCostUsd: discovery.reduce(
        (sum, result) => sum + result.searchCostUsd,
        0,
      ),
    },
    modelVersion: config.model,
    reasoningEffort: config.reasoningEffort ?? null,
    promptVersion: RESEARCH_PROMPT_VERSION,
    durationMs: finished - started,
  };
}

function researchOutcome({
  changedKinds,
  writeFailed,
  researchStatus,
  skipped,
}: {
  changedKinds: CatalogResearchResult["operations"][number]["kind"][];
  writeFailed: boolean;
  researchStatus: CatalogResearchResult["researchStatus"];
  skipped: boolean;
}): CatalogResearchResult["outcome"] {
  if (writeFailed) {
    return "failed";
  }
  if (researchStatus === "failed") {
    return "failed";
  }
  if (skipped) {
    return "skipped";
  }
  if (
    changedKinds.includes("publishEvent") ||
    changedKinds.includes("publishOccurrence")
  ) {
    return "published";
  }
  if (
    changedKinds.includes("createEvent") ||
    changedKinds.includes("createOccurrence")
  ) {
    return "created";
  }
  if (changedKinds.length) {
    return "updated";
  }
  return "unchanged";
}

function safeSource(read: ReadSourceResult) {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    outcome: read.outcome,
    ...(read.reason ? { reason: read.reason } : {}),
  };
}
