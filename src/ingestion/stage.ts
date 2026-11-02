import type { ResearchError, ResearchQuestion } from "./research/contracts";

export type EventNameMismatch = {
  eventId: string;
  storedName: string;
  observedName: string;
};
export type PlanDiagnostics = {
  validation: {
    structural: "passed" | "failed";
    target: "passed" | "failed" | "not_run";
  };
  errors: ResearchError[];
  validationIssues?: { code: string; field: string; stage: "validation" }[];
  unresolved: ResearchQuestion[];
  matchedEventId?: string;
  eventNameMismatch: EventNameMismatch | null;
};

export type StageResult<T> =
  | { status: "continue"; value: T }
  | { status: "skip" | "reject"; diagnostics: PlanDiagnostics };

export function stageDiagnostics<T extends PlanDiagnostics>(
  result: StageResult<T>,
): PlanDiagnostics {
  return result.status === "continue"
    ? diagnosticsOnly(result.value)
    : result.diagnostics;
}

export function diagnosticsOnly({
  validation,
  errors,
  validationIssues,
  unresolved,
  matchedEventId,
  eventNameMismatch,
}: PlanDiagnostics): PlanDiagnostics {
  return {
    validation,
    errors,
    validationIssues,
    unresolved,
    matchedEventId,
    eventNameMismatch,
  };
}
