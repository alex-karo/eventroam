import { stageDiagnostics } from "./stage";
import type { IngestionData } from "./contracts";
import { type ReadyCatalogPlan } from "./catalog-plan";
import type { CatalogItemResult } from "@/catalog/write/apply-operation";

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
export function summarizeCatalogWrite(
  plan: ReadyCatalogPlan,
  applied: CatalogItemResult,
) {
  const changedKinds = plan.operations
    .filter((_, index) => applied.operations[index]?.changed)
    .map((operation) => operation.kind);
  let outcome: "published" | "created" | "updated" | "unchanged";
  if (
    changedKinds.includes("publishEvent") ||
    changedKinds.includes("publishEdition")
  ) {
    outcome = "published";
  } else if (
    changedKinds.includes("createEvent") ||
    changedKinds.includes("createEdition")
  ) {
    outcome = "created";
  } else {
    outcome = changedKinds.length ? "updated" : "unchanged";
  }
  return { outcome, changedKinds };
}
