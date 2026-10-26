import type { LocationExecution } from "./location/agent";
import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import type { ResearchBudgetSnapshot } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { SourceReadMetadata } from "./tools/read-page/contracts";
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
import { LOCATION_PROMPT_VERSION } from "./location/contracts";

export type ReportInput = {
  traceId?: string;
  context: import("./research/context").ResearchContext | null;
  limits: import("./runtime/budget").ResearchLimits;
  runId: string;
  input: CatalogResearchInput;
  config: ResearchConfig;
  prepared: ReturnType<typeof prepareEditorPlan> | null;
  research: ResearchExecution;
  editor: EditorExecution;
  location: LocationExecution;
  applied: ReturnType<typeof applyCatalogItem> | null;
  writeFailed: boolean;
  errors: ResearchError[];
  unresolved: ResearchQuestion[];
  reads: SourceReadMetadata[];
  budget: ResearchBudgetSnapshot;
  started: number;
  finished: number;
};

export function buildResearchReport(input: ReportInput): CatalogResearchResult {
  return assembleReport(input);
}

/** Uses the same diagnostics when the normal report boundary fails. */
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
  traceId,
  context,
  limits,
  input,
  config,
  prepared,
  research,
  editor,
  location,
  applied,
  writeFailed,
  errors,
  unresolved,
  reads,
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
  const changedKinds = operations
    .filter((_, index) => receipts[index]?.changed)
    .map((operation) => operation.kind);
  return {
    schemaVersion: 7,
    ...(traceId ? { traceId } : {}),
    scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    currentDate: context?.currentDate ?? null,
    limits,
    workload: {
      savedEditions:
        context?.catalog.reduce(
          (count, event) => count + event.editions.length,
          0,
        ) ?? 0,
      returnedEditions: finalCandidate?.success
        ? [
            finalCandidate.data.data?.previousEdition,
            finalCandidate.data.data?.currentOrNextEdition,
          ].filter(Boolean).length
        : 0,
    },
    runId,
    mode: input.mode,
    outcome: researchOutcome({
      changedKinds,
      writeFailed:
        writeFailed ||
        editor.status === "failed" ||
        location.status === "failed" ||
        !!(prepared && !prepared.candidate && !prepared.skipped) ||
        !!errors.some(
          (error) =>
            [
              "invalid_candidate",
              "invalid_plan",
              "country_conflict",
              "editor_rejected",
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
    budget,
    locationResponse: location.modelResponse,
    locationStatus: location.status,
    locationPromptVersion: LOCATION_PROMPT_VERSION,
    locationModelVersion: config.locationModel ?? config.model,
    geocoding: {
      observations: location.observations,
      points: location.points,
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

function safeSource(read: SourceReadMetadata) {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    outcome: read.outcome,
    ...(read.reason ? { reason: read.reason } : {}),
  };
}
