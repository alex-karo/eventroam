import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../contracts";
import type { EvalCase } from "./fixtures";
import {
  assertionMatches,
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
  if (result.schemaVersion !== 5) {
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
