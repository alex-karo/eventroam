import type {
  CatalogResearchInput,
  CatalogResearchResult,
  IngestionData,
} from "./contracts";
import { eventLinksCheck, isSocialLinkField, proposalGroup } from "./groups";
import type { ResearchBudgetSnapshot, ResearchLimits } from "./runtime/budget";
import type { ResearchConfig } from "./runtime/config";
import type { SourceReadMetadata } from "./tools/read-page/contracts";
import type { ResearchQuestion } from "./research/contracts";
import type { CheckFinding } from "./roles/contracts";
import type { RepairRecord } from "./repairs";
import { preparationDiagnostics, readyCatalogPlan } from "./pipeline";
import { buildAssignment, assignedRoleChecks } from "./roles/assignment";
import { PROMPT_VERSIONS } from "./roles/versions";
import { LOCATION_PROMPT_VERSION } from "./roles/location/contracts";
import type { Targets } from "./roles/general/contracts";

export type ReportRun = {
  runId: string;
  traceId?: string;
  input: CatalogResearchInput;
  config: Pick<ResearchConfig, "model" | "locationModel" | "reasoningEffort">;
  limits: ResearchLimits;
  repairs: readonly RepairRecord[];
  budget: ResearchBudgetSnapshot;
  started: number;
  finished: number;
};

export function buildResearchReport(
  data: Readonly<IngestionData>,
  {
    runId,
    traceId,
    input,
    config,
    limits,
    repairs,
    budget,
    started,
    finished,
  }: ReportRun,
): CatalogResearchResult {
  const {
    context,
    research,
    general,
    specialists,
    corpus,
    editor,
    location,
    applied,
    errors,
    reads,
  } = data;
  const diagnostics = preparationDiagnostics(data);
  const plan = readyCatalogPlan(data);
  const outcome = data.outcome ?? "failed";
  const { researchStatus, unresolved, inputDuplicate } = assessResearch(
    data,
    input,
    repairs,
    diagnostics?.matchedEventId,
  );
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
  const collectionChecks = research.output?.checks ?? [];
  const interpretationChecks = [
    ...(targets?.checks ?? []),
    ...Object.values(specialists).flatMap(
      (execution) =>
        (execution.output as { checks?: CheckFinding[] } | undefined)?.checks ??
        [],
    ),
  ];
  const eventId =
    diagnostics?.matchedEventId ?? references.event ?? input.eventId;
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
    ...(inputDuplicate ? { inputDuplicate } : {}),
    eventId,
    modelResponse: general.modelResponse ?? null,
    classificationResponse: specialists.classification?.modelResponse ?? null,
    editorResponse: editor.modelResponse,
    ...(repairs.length > 0 && {
      repairs: repairs.map((entry) => ({
        ...entry,
        target: {
          ...entry.target,
          eventId: entry.target.eventId ?? eventId ?? null,
        },
      })),
    }),
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
          ...collectionChecks
            .filter((check) => check.sourceIds.includes(source.id))
            .flatMap((check) => (check.blocker ? [check.blocker] : [])),
          ...interpretationChecks
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

function assessResearch(
  data: Readonly<IngestionData>,
  input: CatalogResearchInput,
  repairs: readonly RepairRecord[],
  matchedEventId: string | undefined,
) {
  const { context, corpus, errors, general, outcome, research } = data;
  const latestRepairs = new Map(repairs.map((entry) => [entry.path, entry]));
  const { openQuestions, repairFailures } = repairQuestions(
    data.unresolved,
    latestRepairs,
  );
  const questions = [...openQuestions, ...repairFailures];
  const collectionChecks = research.output?.checks ?? [];
  const missingCollectionChecks = context
    ? buildAssignment(input, context).checks.filter(
        ({ key }) => !collectionChecks.some((check) => check.check === key),
      )
    : [];
  const roleGaps =
    general.output?.decision === "targets"
      ? interpretationQuestions(
          input,
          general.output,
          data,
          [...latestRepairs.values()],
          questions,
        )
      : [];
  const incomplete =
    repairFailures.length > 0 ||
    general.output?.decision === "uncertain" ||
    roleGaps.length > 0 ||
    collectionChecks.some((check) => check.blocker !== null) ||
    missingCollectionChecks.length > 0 ||
    corpus?.sources.some(
      (source) => source.status === "ok" && source.processing !== "complete",
    );
  const duplicate = context?.inputDuplicate;
  const inputDuplicate =
    input.mode === "add" &&
    outcome === "skipped" &&
    errors.length === 0 &&
    duplicate &&
    matchedEventId === duplicate.eventId
      ? duplicate
      : undefined;
  let researchStatus: CatalogResearchResult["researchStatus"];
  if (inputDuplicate) {
    researchStatus = "success";
  } else if (!corpus?.evidence.length || research.status !== "success") {
    researchStatus = "failed";
  } else {
    researchStatus = incomplete ? "partial" : "success";
  }

  return {
    researchStatus,
    inputDuplicate,
    unresolved: [
      ...questions,
      ...roleGaps.filter(
        (gap) => !questions.some((item) => item.message === gap.message),
      ),
      ...(research.output
        ? missingCollectionChecks.map(({ key }) => ({
            message: `Collection check ${key} was not returned.`,
          }))
        : []),
    ],
  };
}

function repairQuestions(
  questions: readonly ResearchQuestion[],
  latestRepairs: ReadonlyMap<string, RepairRecord>,
) {
  const openQuestions = questions.filter(({ field, editionKey, message }) => {
    const repair = field ? latestRepairs.get(field) : undefined;
    const reason = repair?.omissionReason?.trim();
    const settled =
      repair &&
      reason &&
      repair.decision?.decision === "approve" &&
      !repair.failure &&
      repair.revision == null &&
      (editionKey === undefined || editionKey === repair.target.editionKey) &&
      message.trim() === reason;
    return !settled;
  });
  const repairFailures = [...latestRepairs.values()].flatMap(
    ({ path, target, failure, decision }) =>
      failure && decision?.decision === "reject"
        ? [
            {
              field: path,
              ...(target.editionKey && { editionKey: target.editionKey }),
              message: failure.message,
            },
          ]
        : [],
  );
  return { openQuestions, repairFailures };
}

function interpretationQuestions(
  input: CatalogResearchInput,
  targets: Targets,
  { general, specialists }: Readonly<IngestionData>,
  repairs: readonly RepairRecord[],
  unresolved: readonly ResearchQuestion[],
) {
  return (["general", "tickets", "classification", "links"] as const).flatMap(
    (role) => {
      const execution = role === "general" ? general : specialists[role];
      const findings =
        (execution?.output as { checks?: CheckFinding[] } | undefined)
          ?.checks ?? [];
      return assignedRoleChecks(role, input, targets).flatMap((key) => {
        const repaired = repairs.filter(
          (entry) =>
            entry.owner === role && proposalGroup(entry.path)?.check === key,
        );
        if (repaired.length) {
          const question = unresolved.find(
            ({ field }) =>
              field &&
              (repaired.some(({ path }) => field === path) ||
                (key === eventLinksCheck && isSocialLinkField(field))),
          );
          if (question?.message) {
            return [{ message: `${key}: ${question.message}` }];
          }
        }
        const finding = findings.find(
          (check) => check.check === key && check.finding === "unfinished",
        );
        if (finding) {
          return [{ message: `${key}: ${finding.explanation}` }];
        }
        return findings.some(
          (check) => check.check === key && check.finding === "verified",
        )
          ? []
          : [{ message: `Interpretation check ${key} was not returned.` }];
      });
    },
  );
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
