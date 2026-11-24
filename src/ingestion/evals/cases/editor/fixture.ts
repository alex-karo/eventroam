import type { ReaderSelectionOutput } from "../../../roles/reader/contracts";
import type { RegressionPipelineCaseFile } from "../../fixtures";

type Handoff = NonNullable<RegressionPipelineCaseFile["roleHandoff"]>;
type Passage = ReaderSelectionOutput["evidence"][number];

export function fixedHandoff(
  provenance: string,
  pages: Handoff["pages"],
  roles: Handoff["roles"],
): Handoff {
  return {
    schemaVersion: 7,
    provenance,
    pages,
    collection: { checks: [], unresolved: [] },
    roles,
  };
}

export function readerSelection(
  details: Omit<ReaderSelectionOutput, "coverage">,
): ReaderSelectionOutput {
  return { ...details, coverage: { found: [], notPublished: [] } };
}

export function passage(
  quote: number | [start: number, end: number],
  ...topics: Passage["topics"]
): Passage {
  return {
    quote:
      typeof quote === "number" ? quote : { start: quote[0], end: quote[1] },
    topics,
  };
}

export function setField<T>(value: T, reason: string, evidenceIds: string[]) {
  return { action: "set" as const, value, reason, evidenceIds };
}
