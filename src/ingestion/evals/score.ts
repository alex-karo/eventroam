import { createScorer } from "@mastra/core/evals";
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
  required: AssertionResult[];
  forbidden: AssertionResult[];
  reasons: {
    missingRequired: EvalAssertion[];
    violatedForbidden: EvalAssertion[];
    workflowFailed: boolean;
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

function createdEditionFacts(changes: EvalChange[]) {
  // Older eval reports retained writer changes but not operations/references.
  // Pair the accepted create fields by subject to recover only this event's edition.
  const created = new Map<
    string,
    { eventId?: unknown; key?: unknown; year?: unknown }
  >();
  for (const change of changes) {
    if (
      change.field !== "event_id" &&
      change.field !== "occurrence_key" &&
      change.field !== "occurrence_year"
    ) {
      continue;
    }
    const facts = created.get(change.subject) ?? {};
    if (change.field === "event_id") {
      facts.eventId = change.newValue;
    } else if (change.field === "occurrence_key") {
      facts.key = change.newValue;
    } else {
      facts.year = change.newValue;
    }
    created.set(change.subject, facts);
  }
  return created;
}

function expectedSubjects(
  item: EvalCase,
  result: CatalogResearchResult,
  assertion: EvalAssertion,
): Set<string> {
  if (assertion.owner === "event") {
    return new Set([item.initial.event.id]);
  }
  const editions = item.initial.event.occurrences;
  const subjects = new Set(
    editions
      .filter(
        (edition) =>
          (!assertion.editionKey ||
            edition.occurrenceKey === assertion.editionKey) &&
          (assertion.editionYear === undefined ||
            edition.occurrenceYear === assertion.editionYear),
      )
      .map((edition) => edition.id),
  );
  for (const operation of result.operations) {
    if (
      operation.kind !== "createOccurrence" ||
      operation.eventId !== item.initial.event.id
    ) {
      continue;
    }
    if (
      assertion.editionKey &&
      operation.data.occurrenceKey !== assertion.editionKey
    ) {
      continue;
    }
    if (
      assertion.editionYear !== undefined &&
      operation.data.occurrenceYear !== assertion.editionYear
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
  const created = createdEditionFacts(result.changes);
  for (const [subject, facts] of created) {
    if (
      facts.eventId !== item.initial.event.id ||
      typeof facts.key !== "string"
    ) {
      continue;
    }
    if (
      (!assertion.editionKey || facts.key === assertion.editionKey) &&
      (assertion.editionYear === undefined ||
        facts.year === assertion.editionYear)
    ) {
      subjects.add(subject);
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

export function scoreCase(
  item: EvalCase,
  result: CatalogResearchResult,
): CaseScore {
  const required = item.expectations.required.map((assertion) => ({
    assertion,
    matched: assertionMatches(item, result, assertion),
  }));
  const forbidden = item.expectations.forbidden.map((assertion) => ({
    assertion,
    matched: assertionMatches(item, result, assertion),
  }));
  const failed =
    result.outcome === "failed" ||
    result.gaps.some(
      (gap) =>
        gap.code === "invalid_candidate" ||
        (gap.code === "model_failed" &&
          ["model_failed", "eval_workflow_failed"].includes(gap.detail ?? "")),
    );
  const completeness = failed
    ? 0
    : required.filter((check) => check.matched).length / required.length;
  const correctness = failed
    ? 0
    : 1 - forbidden.filter((check) => check.matched).length / forbidden.length;
  return {
    correctness,
    completeness,
    passed: correctness === 1 && completeness === 1,
    required,
    forbidden,
    reasons: {
      missingRequired: required
        .filter((check) => !check.matched)
        .map((check) => check.assertion),
      violatedForbidden: forbidden
        .filter((check) => check.matched)
        .map((check) => check.assertion),
      workflowFailed: failed,
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
  return { correctness, completeness };
}
