import { stageDiagnostics } from "./stage";
import type { CatalogResearchResult, IngestionData } from "./contracts";
import { type ReadyCatalogPlan } from "./editor/prepare";
import type { applyCatalogItem } from "@/catalog/write/apply-operation";

/** Read the last completed validation for diagnostics, never for flow control. */
export function preparationDiagnostics(data: IngestionData) {
  if (data.catalogPreparation) {
    return stageDiagnostics(data.catalogPreparation);
  }
  if (data.editorValidation) {
    return stageDiagnostics(data.editorValidation);
  }
  return data.researchValidation
    ? stageDiagnostics(data.researchValidation)
    : null;
}

export function readyCatalogPlan(data: IngestionData) {
  return data.catalogPreparation?.status === "continue"
    ? data.catalogPreparation.value
    : null;
}

/** Only writer receipts determine which proposed operations changed the catalog. */
export function catalogWriteOutcome(
  plan: ReadyCatalogPlan,
  applied: ReturnType<typeof applyCatalogItem> | null,
): CatalogResearchResult["outcome"] {
  const changedKinds = plan.operations
    .filter((_, index) => applied?.operations[index]?.changed)
    .map((operation) => operation.kind);
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
  return changedKinds.length ? "updated" : "unchanged";
}
