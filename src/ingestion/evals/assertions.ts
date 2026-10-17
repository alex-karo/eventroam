import type { CatalogResearchResult } from "../contracts";
import type { EvalAssertion, EvalCase } from "./fixtures";

type EvalChange = CatalogResearchResult["changes"][number];
export type AssertionResult = {
  assertion: EvalAssertion;
  matched: boolean;
};

export function contains(actual: unknown, expected: unknown): boolean {
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

export function describeAssertion(assertion: EvalAssertion): string {
  const edition = assertion.editionKey || assertion.editionYear;
  const editionSuffix = edition ? `/${edition}` : "";
  let description = `${assertion.owner}${editionSuffix}.${assertion.field}`;
  if ("value" in assertion) {
    description += `=${JSON.stringify(assertion.value)}`;
  }
  if ("notValue" in assertion) {
    description += ` differs from ${JSON.stringify(assertion.notValue)}`;
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
}
