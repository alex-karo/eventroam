import type { PipelineEvalCase } from "./fixtures";
import type { CatalogResearchResult } from "../contracts";
import type { EvalToolCall } from "./tool-use";
import { mainContext, type Catalog } from "./main/context";
import { roskilde } from "./main/roskilde";
import { wacken } from "./main/wacken";
import { sziget } from "./main/sziget";
import { glastonbury } from "./main/glastonbury";
import { afroNation } from "./main/afro-nation";
import type { evaluate } from "./main/facts";

const evaluators = {
  roskilde,
  wacken,
  sziget,
  glastonbury,
  "afro-nation-portugal-blocked": afroNation,
};
export type MainScore = ReturnType<typeof evaluate>;

export function assertMainCase(item: PipelineEvalCase) {
  if (
    !Object.hasOwn(evaluators, item.id) ||
    item.location ||
    item.researchHandoff
  ) {
    throw new Error(
      `Main case needs a registered pipeline evaluator: ${item.id}`,
    );
  }
}

export function evaluateMainCase(
  item: PipelineEvalCase,
  before: Catalog,
  after: Catalog,
  report: CatalogResearchResult,
  calls: EvalToolCall[],
): MainScore {
  return evaluators[item.id as keyof typeof evaluators](
    mainContext(item, before, after, report, calls),
  );
}
