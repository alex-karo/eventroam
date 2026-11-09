import type { PipelineEvalCase } from "./fixtures";
import type { CatalogResearchResult } from "../contracts";
import { researchContext } from "./research";
import { checks as afroNation } from "./cases/afro-nation-portugal/checks";
import { checks as scopeCurrentOngoing } from "./cases/scope-current-ongoing/checks";
import { checks as scopeCurrentLocalDay } from "./cases/scope-current-local-day/checks";
import { checks as scopeCurrentStableKey } from "./cases/scope-current-stable-key/checks";
import { checks as scopeCurrentReplacement } from "./cases/scope-current-replacement/checks";
import { checks as scopeCurrentAmbiguous } from "./cases/scope-current-ambiguous/checks";
import { checks as scopeFullHistory } from "./cases/scope-full-history/checks";
import { checks as scopeFullUnfinishedHistory } from "./cases/scope-full-unfinished-history/checks";
import { checks as editor } from "./cases/editor/checks";
import { checks as sizeEvidence } from "./cases/size-evidence/checks";
import { checks as sizeHistory } from "./cases/size-history/checks";
import { checks as sourceRegressions } from "./cases/source-regressions/checks";
import { checks as searchPolicy } from "./cases/search-policy/checks";
import { checks as narrowCurrent } from "./cases/narrow-current/checks";
import { checks as wackenAdd } from "./cases/wacken/add";

import { catalogChanges } from "./changes";
import type { Check } from "./checks";
import type { EvalToolCall } from "./tool-use";

export type RegressionContext = ReturnType<typeof researchContext> & {
  changes: ReturnType<typeof catalogChanges>;
  calls: EvalToolCall[];
};
export type RegressionEvaluator = (context: RegressionContext) => Check[];

const evaluators: Record<string, RegressionEvaluator> = {
  ...afroNation,
  ...scopeCurrentOngoing,
  ...scopeCurrentLocalDay,
  ...scopeCurrentStableKey,
  ...scopeCurrentReplacement,
  ...scopeCurrentAmbiguous,
  ...scopeFullHistory,
  ...scopeFullUnfinishedHistory,
  ...editor,
  ...sizeEvidence,
  ...sizeHistory,
  ...sourceRegressions,
  ...searchPolicy,
  ...narrowCurrent,
  ...wackenAdd,
};

export function assertRegressionCase(item: PipelineEvalCase) {
  if (!Object.hasOwn(evaluators, item.id)) {
    throw new Error(
      `Regression case needs a registered regression evaluator: ${item.id}`,
    );
  }
}

export function checkRegressionCase(
  item: PipelineEvalCase,
  report: CatalogResearchResult,
  calls: EvalToolCall[],
) {
  return evaluators[item.id]({
    ...researchContext(item, report),
    changes: catalogChanges(item, report),
    calls,
  });
}
