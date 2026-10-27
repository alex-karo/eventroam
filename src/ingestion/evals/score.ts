import { check, scenarioResult } from "./checks";
import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../contracts";
import type { RegressionPipelineEvalCase, LocationEvalCase } from "./fixtures";
import {
  assertionMatches,
  assertionValueMatches,
  checkAssertions,
} from "./assertions";
import { checkCaseResearch } from "./case-research";
import { checkToolUse, type EvalToolCall } from "./tool-use";

export function scoreCase(
  item: RegressionPipelineEvalCase,
  result: CatalogResearchResult,
  toolCalls: EvalToolCall[],
) {
  return scenarioResult([
    check(
      "execution",
      !hasHostFailure(result),
      "Host workflow or run persistence failed",
    ),
    ...checkAssertions(item.expectations, (assertion) =>
      assertionMatches(item, result, assertion),
    ),
    ...checkCaseResearch(item, result),
    ...checkToolUse(item.expectations.toolUse, toolCalls),
  ]);
}

/** Check Location changes or preserved values without a catalog report. */
export function scoreLocationCase(
  item: LocationEvalCase,
  execution: import("../location/agent").LocationExecution,
) {
  const input = item.location.input;
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
      if (item.location.group !== "preservation" && !observed.changed) {
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
  const missing = execution.observations.some(
    (observation) =>
      observation.result.status === "error" &&
      observation.result.code === "fixture_miss",
  );
  const failed = execution.status !== "success" || missing;
  const executionErrors = failed
    ? execution.errors.map((error) => error.message)
    : [];
  if (missing) {
    executionErrors.push("Unmatched geocoding fixture: fixture_miss");
  }
  if (failed && !executionErrors.length) {
    executionErrors.push("Location execution or output validation failed");
  }
  return scenarioResult([
    check("execution", !failed, executionErrors.join("; ")),
    ...checkAssertions(item.expectations, match),
  ]);
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
