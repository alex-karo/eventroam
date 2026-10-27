import type { PipelineEvalCase } from "./fixtures";
import type { CatalogResearchResult } from "../contracts";
import { researchContext, type ResearchEvaluator } from "./research";
import { researchChecks as scopeCurrentOngoing } from "./cases/scope-current-ongoing/checks";
import { researchChecks as scopeCurrentLocalDay } from "./cases/scope-current-local-day/checks";
import { researchChecks as scopeCurrentStableKey } from "./cases/scope-current-stable-key/checks";
import { researchChecks as scopeCurrentReplacement } from "./cases/scope-current-replacement/checks";
import { researchChecks as scopeCurrentAmbiguous } from "./cases/scope-current-ambiguous/checks";
import { researchChecks as scopeFullHistory } from "./cases/scope-full-history/checks";
import { researchChecks as scopeFullUnfinishedHistory } from "./cases/scope-full-unfinished-history/checks";
import { researchChecks as editor } from "./cases/editor/checks";
import { researchChecks as sizeEvidence } from "./cases/size-evidence/checks";
import { researchChecks as sizeHistory } from "./cases/size-history/checks";
import { researchChecks as sourceRegressions } from "./cases/source-regressions/checks";
import { researchChecks as searchPolicy } from "./cases/search-policy/checks";
import { researchChecks as narrowCurrent } from "./cases/narrow-current/checks";

const evaluators: Record<string, ResearchEvaluator> = {
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
};

export function assertResearchCase(item: PipelineEvalCase) {
  if (!Object.hasOwn(evaluators, item.id)) {
    throw new Error(
      `Regression case needs a registered Research evaluator: ${item.id}`,
    );
  }
}

export function checkCaseResearch(
  item: PipelineEvalCase,
  report: CatalogResearchResult,
) {
  return evaluators[item.id](researchContext(item, report));
}
