import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../contracts";
import type { EvalCase } from "./fixtures";
import {
  assertionMatches,
  assertionValueMatches,
  describeAssertion,
  type AssertionResult,
} from "./assertions";
import { scoreResearch } from "./research-score";
import { scoreToolUse, type EvalToolCall } from "./tool-use";

export type CaseScore = {
  toolUse: ReturnType<typeof scoreToolUse>;
  correctness: number;
  completeness: number;
  passed: boolean;
  research: ReturnType<typeof scoreResearch>;
  diagnostics: Record<
    "execution" | "correctness" | "completeness" | "research" | "toolUse",
    string[]
  >;
  required: AssertionResult[];
  forbidden: AssertionResult[];
};

export function scoreCase(
  item: EvalCase,
  result: CatalogResearchResult,
  toolCalls: EvalToolCall[] = [],
): CaseScore {
  if (result.schemaVersion !== 7) {
    throw new Error(
      `Unsupported catalog report version: ${String(result.schemaVersion)}`,
    );
  }
  const required = item.expectations.required.map((assertion) => ({
    assertion,
    matched: assertionMatches(item, result, assertion),
  }));
  const forbidden = item.expectations.forbidden.map((assertion) => ({
    assertion,
    matched: assertionMatches(item, result, assertion),
  }));
  const hostFailed = hasHostFailure(result);
  const completeness = required.length
    ? required.filter((check) => check.matched).length / required.length
    : 1;
  const correctness = forbidden.length
    ? 1 - forbidden.filter((check) => check.matched).length / forbidden.length
    : 1;
  const research = scoreResearch(item, result);
  const toolUse = scoreToolUse(item.expectations.toolUse, toolCalls);
  return {
    correctness,
    completeness,
    research,
    toolUse,
    diagnostics: {
      execution: hostFailed ? ["Host workflow or persistence failure"] : [],
      correctness: forbidden
        .filter((check) => check.matched)
        .map(
          ({ assertion }) =>
            `Forbidden change: ${describeAssertion(assertion)}`,
        ),
      completeness: required
        .filter((check) => !check.matched)
        .map(
          ({ assertion }) =>
            `Missing required change: ${describeAssertion(assertion)}`,
        ),
      research: research.checks
        .filter((check) => !check.matched)
        .map((check) => check.description),
      toolUse:
        toolUse?.checks
          .filter((check) => !check.matched)
          .map((check) => check.description) ?? [],
    },
    passed:
      !hostFailed &&
      correctness === 1 &&
      completeness === 1 &&
      research.score === 1 &&
      (!toolUse || toolUse.score === 1),
    required,
    forbidden,
  };
}

/** Use the existing assertion details and dimensions without a catalog report. */
export function scoreLocationCase(
  item: EvalCase,
  execution: import("../location/agent").LocationExecution,
): CaseScore {
  const input = item.location!.input;
  const output = execution.modelResponse?.object as
    import("../location/contracts").LocationOutput | undefined;
  const match = (assertion: import("./fixtures").EvalAssertion) =>
    ["previousEdition", "currentOrNextEdition"].some((name) => {
      const slot = name as "previousEdition" | "currentOrNextEdition";
      const target = input[slot],
        fields = execution.materialized?.slots[slot];
      if (
        assertion.owner !== "edition" ||
        !target ||
        !fields ||
        (assertion.editionKey && assertion.editionKey !== target.editionKey) ||
        (assertion.editionYear !== undefined &&
          assertion.editionYear !== target.editionYear)
      ) {
        return false;
      }
      if (assertion.field === "unresolved") {
        return assertionValueMatches(
          execution.materialized!.unresolved.filter(
            (question) => question.editionKey === target.editionKey,
          ),
          assertion,
        );
      }
      const observed = locationValue(
        assertion.field,
        target,
        fields,
        output?.decision.status === "ready"
          ? output.decision[slot]?.coordinates.action
          : undefined,
      );
      if (item.location!.group !== "preservation" && !observed.changed) {
        return false;
      }
      const predicate = [
        "value",
        "notValue",
        "contains",
        "containsAny",
        "containsText",
      ].some((key) => key in assertion);
      return predicate
        ? assertionValueMatches(observed.value, assertion)
        : observed.changed;
    });
  const required = item.expectations.required.map((assertion) => ({
    assertion,
    matched: match(assertion),
  }));
  const forbidden = item.expectations.forbidden.map((assertion) => ({
    assertion,
    matched: match(assertion),
  }));
  const missing = execution.observations.some(
    (observation) =>
      observation.result.status === "error" &&
      observation.result.code === "fixture_miss",
  );
  const completeness = required.length
    ? required.filter((check) => check.matched).length / required.length
    : 1;
  const correctness = forbidden.length
    ? 1 - forbidden.filter((check) => check.matched).length / forbidden.length
    : 1;
  const failed = execution.status !== "success" || missing;
  let executionErrors = failed
    ? ["Location execution or output validation failed"]
    : [];
  if (missing) {
    executionErrors = ["Unmatched geocoding fixture: fixture_miss"];
  }
  return {
    required,
    forbidden,
    completeness,
    correctness,
    research: { score: 1, checks: [] },
    toolUse: null,
    passed: !failed && completeness === 1 && correctness === 1,
    diagnostics: {
      execution: executionErrors,
      correctness: forbidden
        .filter((check) => check.matched)
        .map(
          ({ assertion }) =>
            `Forbidden change: ${describeAssertion(assertion)}`,
        ),
      completeness: required
        .filter((check) => !check.matched)
        .map(
          ({ assertion }) =>
            `Missing required change: ${describeAssertion(assertion)}`,
        ),
      research: [],
      toolUse: [],
    },
  };
}

function finalCoordinates(
  target: import("../location/input").LocationTarget,
  action: NonNullable<
    import("../location/validate").MaterializedLocation["slots"]["currentOrNextEdition"]
  >["coordinates"],
) {
  if (action.action === "set") {
    return action.value;
  }
  if (action.action === "clear" || target.saved?.latitude == null) {
    return null;
  }
  return {
    latitude: target.saved.latitude,
    longitude: target.saved.longitude,
    precision: target.saved.coordinatePrecision,
  };
}
function locationValue(
  field: string,
  target: import("../location/input").LocationTarget,
  fields: NonNullable<
    import("../location/validate").MaterializedLocation["slots"]["currentOrNextEdition"]
  >,
  coordinateAction?: string,
): { value: unknown; changed: boolean } {
  if (field === "coordinate_action") {
    return { value: coordinateAction, changed: true };
  }
  if (
    ["coordinates", "latitude", "longitude", "coordinate_precision"].includes(
      field,
    )
  ) {
    const next = finalCoordinates(target, fields.coordinates);
    const changed =
      fields.coordinates.action !== "keep" &&
      (next?.latitude !== target.saved?.latitude ||
        next?.longitude !== target.saved?.longitude ||
        next?.precision !== target.saved?.coordinatePrecision);
    if (field === "coordinates") {
      return { value: next, changed };
    }
    const key =
      field === "coordinate_precision"
        ? "precision"
        : (field as "latitude" | "longitude");
    return { value: next?.[key] ?? null, changed };
  }
  const key = field.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  ) as keyof import("../location/contracts").LocationFields;
  const action = fields[key];
  if (!action) {
    return { value: undefined, changed: false };
  }
  const old = target.saved?.[key] ?? null;
  let value = old;
  if (action.action === "set") {
    value = action.value;
  }
  if (action.action === "clear") {
    value = null;
  }
  return { value, changed: action.action !== "keep" && value !== old };
}
