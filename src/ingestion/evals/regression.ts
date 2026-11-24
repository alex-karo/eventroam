import type { PipelineEvalCase, RegressionPipelineCaseFile } from "./fixtures";
import type { CatalogResearchResult } from "../contracts";
import { researchContext } from "./research";
import { findCaseDefinition, isLocationDefinition } from "./cases/suite";
import { catalogChanges } from "./changes";
import type { Check } from "./checks";
import type { EvalToolCall } from "./tool-use";

export type RegressionContext = ReturnType<typeof researchContext> & {
  changes: ReturnType<typeof catalogChanges>;
  calls: EvalToolCall[];
};
export type RegressionEvaluator = (context: RegressionContext) => Check[];
export type RegressionCaseDefinition = {
  fixture: RegressionPipelineCaseFile;
  evaluate: RegressionEvaluator;
  moduleUrl: string;
};

function getRegressionEvaluator(id: string): RegressionEvaluator {
  const definition = findCaseDefinition(id);
  if (
    !definition ||
    "descriptionReference" in definition ||
    isLocationDefinition(definition)
  ) {
    throw new Error(
      `Regression case needs a registered regression evaluator: ${id}`,
    );
  }
  return definition.evaluate;
}

export function checkRegressionCase(
  item: PipelineEvalCase,
  report: CatalogResearchResult,
  calls: EvalToolCall[],
) {
  return getRegressionEvaluator(item.id)({
    ...researchContext(item, report),
    changes: catalogChanges(item, report),
    calls,
  });
}
