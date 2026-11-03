import { createScorer, notScorable } from "@mastra/core/evals";
import type { ScenarioResult } from "./checks";
import type { MainScore } from "./main";
import type { EvalGroup } from "./selection";
import type { ReaderEvalOutput } from "./reader";

type EvalInput = { caseId: string; repetition?: number };
type ScoredOutput = { score: ScenarioResult };
type MainOutput = { quality: MainScore };

/** Mastra presents values computed once by the task. */
export function createEvalScorers(group: EvalGroup) {
  if (group !== "main/pipeline") {
    return {
      ...(group === "regression/reader"
        ? {
            recall: createScorer<EvalInput, { reader: ReaderEvalOutput }>({
              id: "evidence-recall",
              description:
                "Complete required evidence available to its specialist",
            })
              .generateScore(
                ({ run }) =>
                  run.output.reader.recall.found /
                  run.output.reader.recall.expected,
              )
              .generateReason(
                ({ run }) =>
                  `${run.output.reader.recall.found}/${run.output.reader.recall.expected} evidence requirements`,
              ),
            binding: createScorer<EvalInput, { reader: ReaderEvalOutput }>({
              id: "literal-validity",
              description:
                "Returned quotations retained after literal source binding",
            })
              .generateScore(({ run }) => {
                const { accepted, supplied } = run.output.reader.binding;
                return supplied ? accepted / supplied : 0;
              })
              .generateReason(
                ({ run }) =>
                  `${run.output.reader.binding.accepted}/${run.output.reader.binding.supplied} quotations bound`,
              ),
          }
        : {}),
      scenario: createScorer<EvalInput, ScoredOutput>({
        id: "scenario-success",
        description: "Targeted regression checks",
      })
        .generateScore(({ run }) => (run.output.score.passed ? 1 : 0))
        .generateReason(
          ({ run }) =>
            run.output.score.checks
              .filter((check) => !check.passed)
              .map((check) => `${check.path}: ${check.message}`)
              .join("; ") || "All checks passed",
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
