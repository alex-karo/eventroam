import type { AcceptedProposals } from "./proposals";
import type { Targets } from "./roles/contracts";
import {
  stageDiagnostics,
  type PlanDiagnostics,
  type StageResult,
} from "./stage";
import { editionSlotNames } from "./research/contracts";
import { shrinkText, type ResearchLogger } from "./runtime/logging";
import type { CatalogOperation } from "@/catalog/operations/operation";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import type { ReadyCatalogPlan } from "./catalog-plan";

export function logPreparation(
  log: ResearchLogger | undefined,
  result: StageResult<AcceptedProposals | ReadyCatalogPlan>,
  targets: Targets,
) {
  const accepted = result.status === "continue";
  const prepared = stageDiagnostics(result);
  const operations =
    accepted && "operations" in result.value ? result.value.operations : [];
  const message = {
    continue: "Editorial plan prepared",
    skip: "Editorial plan skipped",
    reject: "Editorial plan rejected",
  }[result.status];
  log?.[result.status === "reject" ? "warn" : "info"](message, {
    stage: "validation",
    status: "targets",
    eventId: prepared.matchedEventId,
    eventName: targets.observedEventName,
    editions: editionSlotNames.flatMap((slot) => {
      const edition = targets[slot];
      return edition
        ? [
            {
              role: slot,
              editionKey: edition.editionKey,
              year:
                edition.fields.year?.action === "set"
                  ? edition.fields.year.value
                  : null,
            },
          ]
        : [];
    }),
    operationCount: operations.length,
    fields: attemptedCatalogFields(operations),
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
  });
}

export function logCompletion(
  log: ResearchLogger | undefined,
  finalized: CatalogResearchResult,
  input: CatalogResearchInput,
  prepared: PlanDiagnostics | null,
) {
  log?.[
    finalized.outcome === "failed" ||
    finalized.errors.some((error) => error.code === "workflow_failed")
      ? "error"
      : "info"
  ]("Research finished", {
    stage: "report",
    researchStatus: finalized.researchStatus,
    editorStatus: finalized.editorStatus,
    outcome: finalized.outcome,
    validation: prepared?.validation,
    errorCodes: finalized.errors.map((error) => error.code),
    mode: input.mode,
    dryRun: input.dryRun,
    eventId: finalized.eventId,
    durationMs: finalized.durationMs,
    budget: finalized.budget,
  });
}

export function reportEventId(
  input: CatalogResearchInput,
  prepared: PlanDiagnostics | null,
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

export function attemptedCatalogFields(
  operations: CatalogOperation[],
): string[] {
  return [
    ...new Set(
      operations.flatMap((operation) => {
        switch (operation.kind) {
          case "createEvent":
          case "updateEvent":
          case "createEdition":
          case "updateEdition":
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
