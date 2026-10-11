import { createScorer } from "@mastra/core/evals";
import { normalizeWireCandidate } from "../research/agent/wire";
import { researchCandidateSchema } from "../research/contracts";
import { hasHostFailure } from "../runs";
import type { CatalogResearchResult } from "../workflow";
import type { EvalAssertion, EvalCase } from "./fixtures";

type EvalChange = CatalogResearchResult["changes"][number];
export type AssertionResult = {
  assertion: EvalAssertion;
  matched: boolean;
};
export type CaseScore = {
  correctness: number;
  completeness: number;
  passed: boolean;
  research: {
    score: number;
    checks: { description: string; matched: boolean }[];
  } | null;
  required: AssertionResult[];
  forbidden: AssertionResult[];
  reasons: {
    missingRequired: EvalAssertion[];
    violatedForbidden: EvalAssertion[];
    workflowFailed: boolean;
    expectedFailureMissing: boolean;
  };
};

function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    return actual.some((value) => contains(value, expected));
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") {
      return false;
    }
    return Object.entries(expected).every(([key, value]) =>
      contains((actual as Record<string, unknown>)[key], value),
    );
  }
  return Object.is(actual, expected);
}

function expectedSubjects(
  item: EvalCase,
  result: CatalogResearchResult,
  assertion: EvalAssertion,
): Set<string> {
  if (assertion.owner === "event") {
    return new Set([item.initial.event.id]);
  }
  const editions = item.initial.event.editions;
  const subjects = new Set(
    editions
      .filter(
        (edition) =>
          (!assertion.editionKey ||
            edition.editionKey === assertion.editionKey) &&
          (assertion.editionYear === undefined ||
            edition.editionYear === assertion.editionYear),
      )
      .map((edition) => edition.id),
  );
  for (const operation of result.operations) {
    if (
      operation.kind !== "createEdition" ||
      operation.eventId !== item.initial.event.id
    ) {
      continue;
    }
    if (
      assertion.editionKey &&
      operation.data.editionKey !== assertion.editionKey
    ) {
      continue;
    }
    if (
      assertion.editionYear !== undefined &&
      operation.data.editionYear !== assertion.editionYear
    ) {
      continue;
    }
    const id = operation.tempKey
      ? result.references[operation.tempKey]
      : undefined;
    if (id) {
      subjects.add(id);
    }
  }
  return subjects;
}

export function assertionMatches(
  item: EvalCase,
  result: CatalogResearchResult,
  assertion: EvalAssertion,
): boolean {
  const subjects = expectedSubjects(item, result, assertion);
  return result.changes.some((change: EvalChange) => {
    if (!subjects.has(change.subject) || change.field !== assertion.field) {
      return false;
    }
    if ("value" in assertion && !contains(change.newValue, assertion.value)) {
      return false;
    }
    if (
      "notValue" in assertion &&
      contains(change.newValue, assertion.notValue)
    ) {
      return false;
    }
    if (
      "contains" in assertion &&
      !contains(change.newValue, assertion.contains)
    ) {
      return false;
    }
    if (
      assertion.containsText &&
      (typeof change.newValue !== "string" ||
        !change.newValue
          .toLowerCase()
          .replace(/\s+/g, " ")
          .includes(assertion.containsText.toLowerCase().replace(/\s+/g, " ")))
    ) {
      return false;
    }
    if (
      assertion.containsAny &&
      !assertion.containsAny.some((value) => contains(change.newValue, value))
    ) {
      return false;
    }
    if (
      !("value" in assertion) &&
      !("contains" in assertion) &&
      !assertion.containsAny &&
      change.newValue == null
    ) {
      return false;
    }
    return true;
  });
}

function scoreResearch(
  item: EvalCase,
  result: CatalogResearchResult,
): CaseScore["research"] {
  const expected = item.expectations.research;
  if (!expected || expected.status === "failed") {
    return null;
  }
  const parsed = researchCandidateSchema.safeParse(
    normalizeWireCandidate(result.modelResponse?.object),
  );
  const keys = parsed.success
    ? (parsed.data.data?.editions
        .map((e) => e.key)
        .sort((a, b) => a.localeCompare(b)) ?? [])
    : null;
  const checks = [
    {
      description: `researchStatus=${expected.status}`,
      matched:
        result.researchStatus === expected.status &&
        parsed.success &&
        parsed.data.status === expected.status,
    },
  ];
  if (expected.editionKeys) {
    checks.push({
      description: `returned Edition keys=${JSON.stringify(expected.editionKeys)}`,
      matched:
        keys !== null &&
        JSON.stringify(keys) ===
          JSON.stringify(
            [...expected.editionKeys].sort((a, b) => a.localeCompare(b)),
          ),
    });
  }
  for (const fact of expected.facts ?? []) {
    const data = parsed.success ? parsed.data.data : null;
    const target = fact.editionKey
      ? data?.editions.find((e) => e.key === fact.editionKey)
      : data;
    const proposed = target && (target as Record<string, unknown>)[fact.field];
    checks.push({
      description: `returned ${fact.editionKey ?? "event"}.${fact.field}`,
      matched: Boolean(
        proposed &&
        typeof proposed === "object" &&
        "value" in proposed &&
        contains(proposed.value, fact.value),
      ),
    });
  }
  for (const key of expected.unresolvedEditionKeys ?? []) {
    checks.push({
      description: `unfinished ${key}`,
      matched: result.unresolved.some(
        (q) => q.editionKey === key && q.message.trim().length > 0,
      ),
    });
  }
  if (expected.hasUnresolved !== undefined) {
    checks.push({
      description: `has unresolved questions=${expected.hasUnresolved}`,
      matched:
        result.unresolved.some((q) => q.message.trim().length > 0) ===
        expected.hasUnresolved,
    });
  }
  return {
    score: checks.filter((c) => c.matched).length / checks.length,
    checks,
  };
}

export function scoreCase(
  item: EvalCase,
  result: CatalogResearchResult,
): CaseScore {
  if (result.schemaVersion !== 4) {
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
  const expectsFailure = item.expectations.research?.status === "failed";
  const candidate = result.modelResponse?.object;
  const declaredFailure =
    candidate !== null &&
    typeof candidate === "object" &&
    "status" in candidate &&
    candidate.status === "failed" &&
    "data" in candidate &&
    candidate.data === null;
  const unavailable = new Set(
    result.sources
      .filter((source) =>
        ["blocked", "failed", "unsupported"].includes(source.outcome),
      )
      .map((source) => source.attemptedUrl),
  );
  const sourceFailure = result.errors.some(
    (error) =>
      error.stage === "source" &&
      ["source_blocked", "source_unavailable", "source_unsupported"].includes(
        error.code,
      ) &&
      Boolean(error.url && unavailable.has(error.url)) &&
      error.message.trim().length > 0,
  );
  const expectedFailureMet =
    expectsFailure &&
    !hostFailed &&
    result.researchStatus === "failed" &&
    result.outcome === "failed" &&
    declaredFailure &&
    result.operations.length === 0 &&
    result.receipts.length === 0 &&
    result.changes.length === 0 &&
    result.sourceSummaries.length === 0 &&
    Object.keys(result.references).length === 0 &&
    result.sources.length > 0 &&
    result.sources.every((source) =>
      ["blocked", "failed", "unsupported"].includes(source.outcome),
    ) &&
    sourceFailure &&
    !result.errors.some((error) =>
      [
        "model_failed",
        "invalid_candidate",
        "write_failed",
        "limit_reached",
      ].includes(error.code),
    );
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
  return {
    correctness,
    completeness,
    research,
    passed:
      correctness === 1 &&
      completeness === 1 &&
      (!research || research.score === 1),
    required,
    forbidden,
    reasons: {
      missingRequired: required
        .filter((check) => !check.matched)
        .map((check) => check.assertion),
      violatedForbidden: forbidden
        .filter((check) => check.matched)
        .map((check) => check.assertion),
      workflowFailed: hostFailed || (failed && !expectsFailure),
      expectedFailureMissing: expectsFailure && !expectedFailureMet,
    },
  };
}

function describeChecks(
  item: EvalCase,
  result: CatalogResearchResult,
  kind: "required" | "forbidden",
): string {
  const score = scoreCase(item, result);
  if (score.reasons.workflowFailed) {
    return "Research workflow failed";
  }
  if (score.reasons.expectedFailureMissing) {
    return "Expected failed research with null data, no writes, and a source failure tied to an unavailable page";
  }
  const failures =
    kind === "required"
      ? score.required.filter((check) => !check.matched)
      : score.forbidden.filter((check) => check.matched);
  return failures.length
    ? failures
        .map(({ assertion }) => {
          const edition = assertion.editionKey || assertion.editionYear;
          const editionSuffix = edition ? `/${edition}` : "";
          let description = `${assertion.owner}${editionSuffix}.${assertion.field}`;
          if ("value" in assertion) {
            description += `=${JSON.stringify(assertion.value)}`;
          }
          if ("contains" in assertion) {
            description += ` contains ${JSON.stringify(assertion.contains)}`;
          }
          if (assertion.containsAny) {
            description += ` contains one of ${JSON.stringify(assertion.containsAny)}`;
          }
          if (assertion.containsText) {
            description += ` contains text ${JSON.stringify(assertion.containsText)}`;
          }
          return description;
        })
        .join("; ")
    : "All assertions satisfied";
}

export function createEvalScorers(cases: EvalCase[]) {
  const byId = new Map(cases.map((item) => [item.id, item]));
  const find = (input: { caseId: string }) => {
    const item = byId.get(input.caseId);
    if (!item) {
      throw new Error(`Unknown eval case: ${input.caseId}`);
    }
    return item;
  };
  const correctness = createScorer<{ caseId: string }, CatalogResearchResult>({
    id: "catalog-correctness",
    description:
      "Fraction of forbidden catalog mutations absent from the dry-run result",
  })
    .generateScore(
      ({ run }) =>
        scoreCase(find(run.input ?? { caseId: "" }), run.output).correctness,
    )
    .generateReason(({ run }) =>
      describeChecks(
        find(run.input ?? { caseId: "" }),
        run.output,
        "forbidden",
      ),
    );
  const completeness = createScorer<{ caseId: string }, CatalogResearchResult>({
    id: "catalog-completeness",
    description:
      "Fraction of expected catalog mutations present in the dry-run result",
  })
    .generateScore(
      ({ run }) =>
        scoreCase(find(run.input ?? { caseId: "" }), run.output).completeness,
    )
    .generateReason(({ run }) =>
      describeChecks(find(run.input ?? { caseId: "" }), run.output, "required"),
    );
  const research = createScorer<{ caseId: string }, CatalogResearchResult>({
    id: "research-completeness",
    description:
      "Annotated final selection, returned unchanged facts and unfinished research checks; independent of catalog mutations",
  })
    .generateScore(
      ({ run }) =>
        scoreCase(find(run.input ?? { caseId: "" }), run.output).research
          ?.score ?? 1,
    )
    .generateReason(({ run }) => {
      const checks = scoreCase(find(run.input ?? { caseId: "" }), run.output)
        .research?.checks;
      return checks
        ? checks
            .filter((c) => !c.matched)
            .map((c) => c.description)
            .join("; ") || "All research assertions satisfied"
        : "No separate research annotations for this case";
    });
  return { correctness, completeness, research };
}
