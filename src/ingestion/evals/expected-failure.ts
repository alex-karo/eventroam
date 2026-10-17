import type { CatalogResearchResult } from "../contracts";
import { hasHostFailure } from "../runs";
import type { EvalCase } from "./fixtures";

/** Every condition is required. The descriptions also explain a rejected failure. */
export function checkExpectedFailure(
  item: EvalCase,
  result: CatalogResearchResult,
) {
  if (item.expectations.research?.status !== "failed") {
    return null;
  }
  const candidate = result.modelResponse?.object;
  const checks = [
    {
      description:
        "Expected failure must not include a host workflow or persistence failure",
      matched: !hasHostFailure(result),
    },
    {
      description: "Expected researchStatus=failed",
      matched: result.researchStatus === "failed",
    },
    {
      description: "Expected catalog outcome=failed",
      matched: result.outcome === "failed",
    },
    {
      description: "Expected model response with status=failed and data=null",
      matched:
        candidate !== null &&
        typeof candidate === "object" &&
        "status" in candidate &&
        candidate.status === "failed" &&
        "data" in candidate &&
        candidate.data === null,
    },
    {
      description: "Expected no operations",
      matched: result.operations.length === 0,
    },
    {
      description: "Expected no receipts",
      matched: result.receipts.length === 0,
    },
    {
      description: "Expected no catalog changes",
      matched: result.changes.length === 0,
    },
    {
      description: "Expected no source summaries",
      matched: result.sourceSummaries.length === 0,
    },
    {
      description: "Expected no references",
      matched: Object.keys(result.references).length === 0,
    },
    {
      description: "Expected at least one inspected source",
      matched: result.sources.length > 0,
    },
    {
      description:
        "Expected failure must not include model, candidate, write, or limit errors",
      matched: !result.errors.some((error) =>
        [
          "model_failed",
          "invalid_candidate",
          "write_failed",
          "limit_reached",
        ].includes(error.code),
      ),
    },
  ];
  if (item.expectations.research.failureReason === "identity_conflict") {
    checks.push(
      {
        description: "Expected identity conflict to skip editing",
        matched: result.editorStatus === "not_run",
      },
      {
        description: "Expected identity conflict to stop without search",
        matched: result.usage.searches === 0,
      },
      {
        description:
          "Expected identity conflict evidence from an available source",
        matched: result.sources.some((source) => source.outcome === "ok"),
      },
      {
        description:
          "Expected identity conflict to inspect only fixture sources",
        matched: result.sources.every((source) =>
          item.sources.some(
            (expected) => expected.attemptedUrl === source.attemptedUrl,
          ),
        ),
      },
      {
        description:
          "Expected an unresolved identity question directing a full refresh",
        matched: result.unresolved.some(
          (question) =>
            question.field === "identity" && /full/i.test(question.message),
        ),
      },
    );
  } else {
    const unavailable = new Set(
      result.sources
        .filter((source) =>
          ["blocked", "failed", "unsupported"].includes(source.outcome),
        )
        .map((source) => source.attemptedUrl),
    );
    checks.push(
      {
        description: "Expected all inspected sources to be unavailable",
        matched: result.sources.every((source) =>
          ["blocked", "failed", "unsupported"].includes(source.outcome),
        ),
      },
      {
        description:
          "Expected a source-failure diagnosis for an unavailable inspected URL",
        matched: result.errors.some(
          (error) =>
            error.stage === "source" &&
            [
              "source_blocked",
              "source_unavailable",
              "source_unsupported",
            ].includes(error.code) &&
            Boolean(error.url && unavailable.has(error.url)) &&
            error.message.trim().length > 0,
        ),
      },
    );
  }
  return checks;
}
