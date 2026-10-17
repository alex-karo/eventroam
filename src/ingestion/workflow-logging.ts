import { writeObservation, type WriteDisposition } from "./write-observation";
import { shrinkText, type ResearchLogger } from "./runtime/logging";
import type { CatalogOperation } from "@/catalog/operations/operation";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "./contracts";
import { prepareEditorPlan } from "./editor/prepare";

export function logPreparation(
  log: ResearchLogger | undefined,
  prepared: ReturnType<typeof prepareEditorPlan>,
) {
  const accepted =
    prepared.candidate &&
    prepared.candidate.status !== "failed" &&
    prepared.validation.target === "passed" &&
    !prepared.errors.some(
      (error) =>
        error.code === "invalid_plan" || error.code === "editor_rejected",
    );
  log?.[accepted ? "info" : "warn"](
    accepted ? "Editorial plan prepared" : "Editorial plan rejected",
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
  prepared: ReturnType<typeof prepareEditorPlan> | null,
  applied: ReturnType<typeof applyCatalogItem> | null,
  writeState: WriteDisposition,
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
    ...writeObservation(input, applied, writeState),
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
  prepared: ReturnType<typeof prepareEditorPlan> | null,
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
