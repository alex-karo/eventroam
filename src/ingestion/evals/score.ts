import { check, scenarioResult } from "./checks";
import { reviewOutput } from "../roles/editor/contracts";
import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../contracts";
import type { RegressionPipelineEvalCase, LocationEvalCase } from "./fixtures";
import { checkRegressionCase } from "./regression";
import { checkLocationCase } from "./location";
import type { EvalToolCall } from "./tool-use";
import type { LocationExecution } from "../roles/location/agent";

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
    ...(item.roleHandoff
      ? [
          check(
            "editor.fixed-handoff",
            !reviewOutput
              .safeParse(result.editorResponse?.object)
              .data?.decisions.some(({ decision }) => decision === "return"),
            "Editor requested a return during a fixed handoff",
          ),
        ]
      : []),
    ...checkRegressionCase(item, result, toolCalls),
  ]);
}

export function scoreLocationCase(
  item: LocationEvalCase,
  execution: LocationExecution,
) {
  const failed = execution.status !== "success";
  const errors = failed ? execution.errors.map((error) => error.message) : [];
  if (failed && !errors.length) {
    errors.push("Location execution or output validation failed");
  }
  return scenarioResult([
    check("execution", !failed, errors.join("; ")),
    ...checkLocationCase(item, execution),
  ]);
}
