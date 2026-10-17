import { createScorer } from "@mastra/core/evals";
import type { CaseScore } from "./score";

type EvalInput = { caseId: string; repetition?: number };
type ScoredOutput = { score: CaseScore };

/** Mastra presents the score already computed by the eval task. */
export function createEvalScorers() {
  const correctness = createScorer<EvalInput, ScoredOutput>({
    id: "catalog-correctness",
    description:
      "Fraction of forbidden catalog mutations absent from the dry-run result",
  })
    .generateScore(({ run }) => run.output.score.correctness)
    .generateReason(
      ({ run }) =>
        run.output.score.diagnostics.correctness.join("; ") ||
        "All assertions satisfied",
    );
  const completeness = createScorer<EvalInput, ScoredOutput>({
    id: "catalog-completeness",
    description:
      "Fraction of expected catalog mutations present in the dry-run result",
  })
    .generateScore(({ run }) => run.output.score.completeness)
    .generateReason(
      ({ run }) =>
        run.output.score.diagnostics.completeness.join("; ") ||
        "All assertions satisfied",
    );
  const research = createScorer<EvalInput, ScoredOutput>({
    id: "research-completeness",
    description:
      "Research outcome, expected safe failures, returned facts and unfinished research checks",
  })
    .generateScore(({ run }) => run.output.score.research.score)
    .generateReason(
      ({ run }) =>
        run.output.score.diagnostics.research.join("; ") ||
        "All research assertions satisfied",
    );
  const toolUse = createScorer<EvalInput, ScoredOutput>({
    id: "source-search-policy",
    description: "Search count and page-read order for exceptional discovery",
  })
    .generateScore(({ run }) => run.output.score.toolUse?.score ?? 1)
    .generateReason(
      ({ run }) =>
        run.output.score.diagnostics.toolUse.join("; ") ||
        "Search policy satisfied",
    );
  return { correctness, completeness, research, toolUse };
}
