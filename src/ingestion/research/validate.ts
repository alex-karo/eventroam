import type { CatalogResearchInput } from "../contracts";
import type { ResearchCatalog } from "./context";
import {
  researchCandidateSchema,
  type ResearchCandidate,
  type ResearchData,
} from "./contracts";
import { validateRefresh } from "./guards";
import {
  diagnosticsOnly,
  type PlanDiagnostics,
  type StageResult,
} from "../stage";

export type CheckedResearch = PlanDiagnostics & {
  candidate: Omit<ResearchCandidate, "status" | "data"> & {
    status: "success" | "partial";
    data: ResearchData;
  };
};
function invalid(result: PlanDiagnostics, message: string): StageResult<never> {
  result.errors.push({
    code: "invalid_candidate",
    stage: "validation",
    message,
  });
  return { status: "reject", diagnostics: diagnosticsOnly(result) };
}
/** Validate research and assignment before editing. Never creates mutations. */
export function validateResearch(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
): StageResult<CheckedResearch> {
  const result: PlanDiagnostics = {
    validation: { structural: "failed", target: "not_run" },
    errors: [],
    unresolved: [],
    eventNameMismatch: null,
  };
  const parsed = researchCandidateSchema.safeParse(raw);
  if (!parsed.success) {
    result.validationIssues = parsed.error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.join(".") || "$",
      stage: "validation",
    }));
    return invalid(
      result,
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}:${issue.code}`)
        .join(", "),
    );
  }
  result.validation.structural = "passed";
  const candidate = parsed.data;
  result.errors = candidate.errors.map((error) => ({
    ...error,
    stage: error.code === "limit_reached" ? "research" : "source",
  }));
  result.unresolved = candidate.unresolved;
  if (candidate.status === "failed") {
    return { status: "reject", diagnostics: diagnosticsOnly(result) };
  }
  const data = candidate.data!;
  const matchedEventId = data.eventId ?? input.eventId;
  const event = catalog.find((item) => item.id === matchedEventId);
  if (
    (matchedEventId && !event) ||
    (input.eventId && data.eventId && input.eventId !== data.eventId) ||
    (!event && input.mode !== "add")
  ) {
    result.validation.target = "failed";
    result.validationIssues = [
      { code: "invalid_target", field: "data.eventId", stage: "validation" },
    ];
    return invalid(result, "Event is outside the requested catalog target");
  }
  result.validation.target = "passed";
  result.matchedEventId = matchedEventId;
  if (event && event.canonicalName.trim() !== data.eventName.trim()) {
    result.eventNameMismatch = {
      eventId: event.id,
      storedName: event.canonicalName,
      observedName: data.eventName,
    };
  }
  if (input.mode === "add" && event) {
    return { status: "skip", diagnostics: diagnosticsOnly(result) };
  }
  if (input.mode === "refresh") {
    const error = validateRefresh(candidate, event!.editions, input.scope);
    if (error) {
      result.errors.push(error);
      return { status: "reject", diagnostics: diagnosticsOnly(result) };
    }
  }
  return {
    status: "continue",
    value: {
      ...result,
      candidate: { ...candidate, status: candidate.status, data },
    },
  };
}
