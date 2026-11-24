import type { Source } from "../../evidence/contracts";
import type { ResearchError } from "../../research/contracts";
import type { CollectionOutput } from "./contracts";

export function validateResearchSummary(
  output: CollectionOutput | undefined,
  sources: Source[],
): ResearchError | undefined {
  const checks = output?.checks ?? [];
  const saved = new Set(sources.map(({ id }) => id));
  if (
    new Set(checks.map(({ check }) => check)).size !== checks.length ||
    checks.some(({ sourceIds }) => sourceIds.some((id) => !saved.has(id)))
  ) {
    return {
      code: "invalid_candidate",
      stage: "validation",
      message: "Collection check references are invalid",
    };
  }
}
