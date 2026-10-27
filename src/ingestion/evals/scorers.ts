import { createScorer, notScorable } from "@mastra/core/evals";
import type { CaseScore } from "./score";
import type { MainScore } from "./main";

type EvalInput = { caseId: string; repetition?: number };
type ScoredOutput = { score: CaseScore };
type MainOutput = { quality: MainScore };

/** Mastra presents values computed once by the task. */
export function createEvalScorers(main = false) {
  if (!main) {
    return {
      scenario: createScorer<EvalInput, ScoredOutput>({
        id: "scenario-success",
        description: "Targeted regression checks",
      })
        .generateScore(({ run }) => (run.output.score.passed ? 1 : 0))
        .generateReason(
          ({ run }) =>
            Object.values(run.output.score.diagnostics).flat().join("; ") ||
            "All checks passed",
        ),
    };
  }
  const completeness = (kind: "required" | "additional") =>
    createScorer<EvalInput, MainOutput>({
      id: `${kind}-completeness`,
      description: `Correct available ${kind} facts`,
    })
      .preprocess(({ run }) =>
        run.output.quality[kind].expected
          ? {}
          : notScorable("No expected facts"),
      )
      .generateScore(({ run }) => run.output.quality[kind].score!)
      .generateReason(({ run }) => {
        const total = run.output.quality[kind];
        return `${total.correct}/${total.expected} facts`;
      });
  return {
    required: completeness("required"),
    additional: completeness("additional"),
    accuracy: createScorer<EvalInput, MainOutput>({
      id: "no-checked-errors",
      description: "No checked factual errors",
    })
      .generateScore(({ run }) => run.output.quality.noCheckedErrors)
      .generateReason(
        ({ run }) => `${run.output.quality.errorCount} failed factual checks`,
      ),
    scenario: createScorer<EvalInput, MainOutput>({
      id: "scenario-success",
      description:
        "Required facts, checked errors, publication and task conditions",
    })
      .generateScore(({ run }) => (run.output.quality.passed ? 1 : 0))
      .generateReason(
        ({ run }) =>
          run.output.quality.conditions
            .filter((c) => !c.passed)
            .map((c) => `${c.path}: ${c.message}`)
            .join("; ") || "See fact checks in task output",
      ),
  };
}
