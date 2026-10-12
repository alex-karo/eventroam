import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import type { ResearchBudgetSnapshot } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { ReadSourceResult } from "./tools/read-source/contracts";
import type { DiscoverSourcesResult } from "./tools/discover-sources/contracts";
import {
  RESEARCH_PROMPT_VERSION,
  researchCandidateSchema,
  type ResearchError,
  type ResearchQuestion,
} from "./research/contracts";
import type { prepareEditorPlan } from "./editor/prepare";
import { EDITOR_PROMPT_VERSION } from "./editor/contracts";
import type { EditorExecution } from "./editor/agent";
import type { ResearchExecution } from "./research/agent";
import { sumKnownModelCosts } from "./research/agent/usage";

export type ReportInput = {
  context: import("./research/context").ResearchContext | null;
  limits: import("./runtime/budget").ResearchLimits;
  runId: string;
  input: CatalogResearchInput;
  config: ResearchConfig;
  prepared: ReturnType<typeof prepareEditorPlan> | null;
  research: ResearchExecution;
  editor: EditorExecution;
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
  context,
  limits,
  input,
  config,
  prepared,
  research,
  editor,
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
      subject: change.editionId ?? change.eventId ?? "",
      field: field.field,
      oldValue: field.oldValue,
      newValue: field.newValue,
      explanations:
        prepared?.explanations[change.operationKey]?.[field.field] ?? [],
    })),
  );
  const finalCandidate = research.ok
    ? researchCandidateSchema.safeParse(research.candidate)
    : null;
  const researchStatus =
    !research.ok || !finalCandidate?.success
      ? "failed"
      : finalCandidate.data.status;
  const inputTokens = research.usage.inputTokens + editor.usage.inputTokens;
  const outputTokens = research.usage.outputTokens + editor.usage.outputTokens;
  const cachedInputTokens =
    research.usage.cachedInputTokens === null ||
    editor.usage.cachedInputTokens === null
      ? null
      : research.usage.cachedInputTokens + editor.usage.cachedInputTokens;
  const reasoningTokens =
    research.usage.reasoningTokens === null ||
    editor.usage.reasoningTokens === null
      ? null
      : research.usage.reasoningTokens + editor.usage.reasoningTokens;
  const modelCostUsd = sumKnownModelCosts([
    research.usage.modelCostUsd,
    editor.usage.modelCostUsd,
  ]);
  const usageComplete =
    research.usage.complete &&
    editor.usage.complete &&
    budget.searches === discovery.length &&
    discovery.every((result) => result.usageComplete !== false);
  const changedKinds = operations
    .filter((_, index) => receipts[index]?.changed)
    .map((operation) => operation.kind);
  return {
    schemaVersion: 5,
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    currentDate:
      input.mode === "refresh" ? (context?.currentDate ?? null) : null,
    limits,
    workload: {
      savedEditions:
        input.mode === "refresh"
          ? (context?.catalog[0]?.editions.length ?? 0)
          : 0,
      returnedEditions: finalCandidate?.success
        ? (finalCandidate.data.data?.editions.length ?? 0)
        : 0,
    },
    runId,
    mode: input.mode,
    outcome: researchOutcome({
      changedKinds,
      writeFailed:
        writeFailed ||
        editor.status === "failed" ||
        !!(prepared && !prepared.candidate && !prepared.skipped) ||
        !!errors.some(
          (error) =>
            [
              "invalid_candidate",
              "invalid_plan",
              "country_conflict",
              "country_baseline_conflict",
            ].includes(error.code) ||
            (error.code === "workflow_failed" && !applied),
        ),
      researchStatus,
      skipped: prepared?.skipped ?? false,
    }),
    researchStatus,
    eventId: prepared?.matchedEventId ?? references.event ?? input.eventId,
    modelResponse: research.modelResponse ?? null,
    editorResponse: editor.modelResponse,
    editorStatus: editor.status,
    editorPromptVersion: EDITOR_PROMPT_VERSION,
    operations,
    receipts,
    references,
    changes,
    sources: reads.map(safeSource),
    sourceSummaries:
      prepared?.validation.target === "passed" && finalCandidate?.success
        ? (finalCandidate.data.data?.sources ?? [])
        : [],
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
      modelCostUsd: sumKnownModelCosts([
        modelCostUsd,
        ...discovery.map((result) => result.modelCostUsd),
      ]),
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
    changedKinds.includes("publishEdition")
  ) {
    return "published";
  }
  if (
    changedKinds.includes("createEvent") ||
    changedKinds.includes("createEdition")
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
