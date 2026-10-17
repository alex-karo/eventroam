import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../contracts";
import type { EvalCase } from "./fixtures";
import {
  assertionMatches,
  describeAssertion,
  type AssertionResult,
} from "./assertions";
import { checkExpectedFailure } from "./expected-failure";
import { scoreResearch } from "./research-score";
import { scoreToolUse, type EvalToolCall } from "./tool-use";

export type CaseScore = {
  toolUse: ReturnType<typeof scoreToolUse>;
  correctness: number;
  completeness: number;
  passed: boolean;
  research: ReturnType<typeof scoreResearch>;
  diagnostics: Record<
    "correctness" | "completeness" | "research" | "toolUse",
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
  const failed =
    hostFailed ||
    result.outcome === "failed" ||
    result.researchStatus === "failed";
  const failureChecks = checkExpectedFailure(item, result);
  const expectsFailure = failureChecks !== null;
  const expectedFailureMet =
    failureChecks?.every((check) => check.matched) ?? false;
  let completeness = required.length
    ? required.filter((check) => check.matched).length / required.length
    : 1;
  let correctness = forbidden.length
    ? 1 - forbidden.filter((check) => check.matched).length / forbidden.length
    : 1;
  if (expectsFailure) {
    completeness = Number(expectedFailureMet);
    correctness = Number(expectedFailureMet);
  } else if (failed) {
    completeness = 0;
    correctness = 0;
  }
  const research = scoreResearch(item, result);
  const toolUse = scoreToolUse(item.expectations.toolUse, toolCalls);
  const failureDiagnostics = failureChecks
    ? failureChecks
        .filter((check) => !check.matched)
        .map((check) => check.description)
    : [
        ...(hostFailed ? ["Host workflow or persistence failure"] : []),
        ...(result.outcome === "failed" ? ["Catalog outcome is failed"] : []),
        ...(result.researchStatus === "failed"
          ? ["Research status is failed"]
          : []),
      ];
  return {
    correctness,
    completeness,
    research,
    toolUse,
    diagnostics: {
      correctness: [
        ...failureDiagnostics,
        ...forbidden
          .filter((check) => check.matched)
          .map(
            ({ assertion }) =>
              `Forbidden change: ${describeAssertion(assertion)}`,
          ),
      ],
      completeness: [
        ...failureDiagnostics,
        ...required
          .filter((check) => !check.matched)
          .map(
            ({ assertion }) =>
              `Missing required change: ${describeAssertion(assertion)}`,
          ),
      ],
      research:
        research?.checks
          .filter((check) => !check.matched)
          .map((check) => check.description) ?? [],
      toolUse:
        toolUse?.checks
          .filter((check) => !check.matched)
          .map((check) => check.description) ?? [],
    },
    passed:
      correctness === 1 &&
      completeness === 1 &&
      (!research || research.score === 1) &&
      (!toolUse || toolUse.score === 1),
    required,
    forbidden,
  };
}
