import { shrinkText, type ResearchLogger } from "./runtime/logging";
import type { CatalogOperation } from "@/catalog/operations/operation";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import { prepareResearch } from "./research/prepare";

export function logPreparation(
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

export function logCompletion(
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

export function reportEventId(
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

export function writeDisposition(
  input: CatalogResearchInput,
  applied: ReturnType<typeof applyCatalogItem>,
) {
  return !input.dryRun &&
    applied.operations.some((operation) => operation.changed)
    ? "committed"
    : "unchanged";
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
export function writeLogFields(
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
