import type { PlanDiagnostics } from "./stage";
import type { LocationExecution } from "./location/agent";
import type { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import type { ResearchBudgetSnapshot } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { SourceReadMetadata } from "./tools/read-page/contracts";
import {
  type ResearchError,
  type ResearchQuestion,
} from "./research/contracts";
import type { ReadyCatalogPlan } from "./catalog-plan";
import type { EditorExecution } from "./roles/editor-execution";
import type { RoleExecution } from "./roles/invoke";
import type { CollectionOutput, GeneralOutput } from "./roles/contracts";
import type { FrozenCorpus } from "./evidence/contracts";
import { buildAssignment, assignedRoleChecks } from "./roles/assignment";
import { PROMPT_VERSIONS } from "./roles/versions";
import { LOCATION_PROMPT_VERSION } from "./location/contracts";

export type ReportInput = {
  traceId?: string;
  context: import("./research/context").ResearchContext | null;
  limits: import("./runtime/budget").ResearchLimits;
  runId: string;
  input: CatalogResearchInput;
  config: ResearchConfig;
  diagnostics: PlanDiagnostics | null;
  plan: ReadyCatalogPlan | null;
  outcome: CatalogResearchResult["outcome"];
  research: RoleExecution<CollectionOutput>;
  general: RoleExecution<GeneralOutput>;
  corpus: FrozenCorpus | null;
  specialists: Record<string, RoleExecution>;
  editor: EditorExecution;
  location: LocationExecution;
  applied: ReturnType<typeof applyCatalogItem> | null;
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
  return assembleReport(input);
}

function assembleReport({
  runId,
  traceId,
  context,
  limits,
  input,
  config,
  diagnostics,
  plan,
  outcome,
  research,
  general,
  specialists,
  corpus,
  editor,
  location,
  applied,
  errors,
  unresolved,
  reads,
  budget,
  started,
  finished,
}: ReportInput): CatalogResearchResult {
  const operations = plan?.operations ?? [];
  const receipts = applied?.operations ?? [];
  const references = applied?.references ?? {};
  const changes = (applied?.changes ?? []).flatMap((change) =>
    change.changedFields.map((field) => ({
      subject: change.editionId ?? change.eventId ?? "",
      field: field.field,
      oldValue: field.oldValue,
      newValue: field.newValue,
      explanations:
        plan?.explanations[change.operationKey]?.[field.field] ?? [],
    })),
  );
  const targets =
    general.output?.decision === "targets" ? general.output : null;
  const assignment = context ? buildAssignment(input, context) : null;
  const checks = [
    ...(research.output?.checks ?? []),
    ...(general.output?.decision === "targets" ? general.output.checks : []),
    ...Object.values(specialists).flatMap(
      (execution) =>
        (
          execution.output as
            { checks?: CollectionOutput["checks"] } | undefined
        )?.checks ?? [],
    ),
  ];
  const missingRoleCheck =
    targets &&
    (["general", "tickets", "classification", "links"] as const).some(
      (role) => {
        const execution = role === "general" ? general : specialists[role];
        const findings =
          (
            execution?.output as
              { checks?: CollectionOutput["checks"] } | undefined
          )?.checks ?? [];
        return assignedRoleChecks(role, input, targets).some(
          (key) =>
            !findings.some(
              (check) => check.check === key && check.finding === "verified",
            ),
        );
      },
    );
  const usable = !!corpus?.evidence.length;
  const incomplete =
    missingRoleCheck ||
    checks.some((check) => check.finding === "unfinished") ||
    assignment?.checks.some(
      (assigned) =>
        !checks.some(
          (check) =>
            check.check === assigned.key && check.finding === "verified",
        ),
    ) ||
    corpus?.sources.some(
      (source) => source.status === "ok" && source.processing !== "complete",
    );
  let researchStatus: "failed" | "partial" | "success" = incomplete
    ? "partial"
    : "success";
  if (!usable || research.status !== "success") {
    researchStatus = "failed";
  }

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
      returnedEditions: targets
        ? [targets.previousEdition, targets.currentOrNextEdition].filter(
            Boolean,
          ).length
        : 0,
    },
    runId,
    mode: input.mode,
    outcome,
    researchStatus,
    eventId: diagnostics?.matchedEventId ?? references.event ?? input.eventId,
    modelResponse: general.modelResponse ?? null,
    editorResponse: editor.modelResponse,
    editorStatus: editor.status,
    editorPromptVersion: PROMPT_VERSIONS.editor,
    operations,
    receipts,
    references,
    changes,
    sources: reads.map(safeSource),
    sourceSummaries: (corpus?.sources ?? [])
      .filter((source) => source.overview)
      .map((source) => ({
        url: source.finalUrl,
        information: [
          source.overview,
          ...checks
            .filter((check) => check.sourceIds.includes(source.id))
            .map((check) => check.explanation),
        ].join(" "),
      })),
    errors,
    unresolved,
    eventNameMismatch: diagnostics?.eventNameMismatch ?? null,
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
    promptVersion: PROMPT_VERSIONS.general,
    durationMs: finished - started,
  };
}

function safeSource(read: SourceReadMetadata) {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    outcome: read.status,
    ...(read.reasonCode ? { reason: read.reasonCode } : {}),
  };
}
