import type { Source } from "../../evidence/contracts";
import type { ResearchError } from "../../research/contracts";
import type { buildAssignment } from "../assignment";
import type { CollectionOutput } from "./contracts";

export function validateResearchSummary(
  output: CollectionOutput | undefined,
  assignment: ReturnType<typeof buildAssignment>,
  sources: Source[],
): ResearchError | undefined {
  const checks = output?.checks ?? [];
  const assigned = new Set(assignment.checks.map(({ key }) => key));
  const saved = new Set(sources.map(({ id }) => id));
  if (
    new Set(checks.map(({ check }) => check)).size !== checks.length ||
    checks.some(
      ({ check, sourceIds }) =>
        !assigned.has(check) || sourceIds.some((id) => !saved.has(id)),
    )
  ) {
    return {
      code: "invalid_candidate",
      stage: "validation",
      message: "Collection check references are invalid",
    };
  }
}
