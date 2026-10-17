import type { CatalogItemResult } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput } from "./contracts";

export type WriteDisposition =
  "committed" | "rolled_back" | "unchanged" | "not_attempted" | "unknown";

/** Project existing writer evidence once for logs and traces. */
export function writeObservation(
  input: Pick<CatalogResearchInput, "dryRun">,
  applied: CatalogItemResult | null,
  writeState: WriteDisposition = "not_attempted",
) {
  if (applied) {
    const changed = input.dryRun
      ? 0
      : applied.operations.filter((operation) => operation.changed).length;
    return {
      writeState: changed ? ("committed" as const) : ("unchanged" as const),
      committedOperationCount: changed,
    };
  }
  return {
    writeState,
    committedOperationCount: writeState === "unknown" ? null : 0,
  };
}
