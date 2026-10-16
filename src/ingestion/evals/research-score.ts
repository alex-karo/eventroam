import { normalizeWireCandidate } from "../research/agent/wire";
import {
  type ResearchCandidate,
  researchCandidateSchema,
} from "../research/contracts";
import type { CatalogResearchResult } from "../contracts";
import type { EvalCase } from "./fixtures";
import { contains } from "./assertions";

function researchTarget(
  data: ResearchCandidate["data"] | undefined,
  selector: { editionKey?: string; editionYear?: number },
) {
  if (selector.editionKey) {
    return data?.editions.find((e) => e.key === selector.editionKey);
  }
  if (selector.editionYear !== undefined) {
    return data?.editions.find((e) => e.year?.value === selector.editionYear);
  }
  return data;
}

export function scoreResearch(item: EvalCase, result: CatalogResearchResult) {
  const expected = item.expectations.research;
  if (!expected || expected.status === "failed") {
    return null;
  }
  const parsed = researchCandidateSchema.safeParse(
    normalizeWireCandidate(result.modelResponse?.object),
  );
  const data = parsed.success ? parsed.data.data : null;
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
  if (expected.newEditionYear !== undefined) {
    const editions = data?.editions;
    const savedKeys = new Set(
      item.initial.event.editions.map((e) => e.editionKey),
    );
    checks.push({
      description: `one new Edition for year=${expected.newEditionYear}`,
      matched:
        editions?.length === 1 &&
        !savedKeys.has(editions[0].key) &&
        editions[0].year?.value === expected.newEditionYear,
    });
  }
  for (const fact of expected.facts ?? []) {
    const target = researchTarget(data, fact);
    const proposed = target && (target as Record<string, unknown>)[fact.field];
    checks.push({
      description: `returned ${fact.editionKey ?? fact.editionYear ?? "event"}.${fact.field}`,
      matched: Boolean(
        proposed &&
        typeof proposed === "object" &&
        "value" in proposed &&
        contains(proposed.value, fact.value),
      ),
    });
  }
  for (const fact of expected.absentFields ?? []) {
    const target = researchTarget(data, fact);
    const proposed = fact.field
      .split(".")
      .reduce<unknown>(
        (value, key) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined,
        target,
      );
    checks.push({
      description: `omitted ${fact.editionKey ?? fact.editionYear ?? "event"}.${fact.field}`,
      matched: Boolean(target) && proposed == null,
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
  if (expected.noChanges) {
    checks.push({
      description: "no catalog changes",
      matched: result.changes.length === 0,
    });
  }
  return {
    score: checks.filter((c) => c.matched).length / checks.length,
    checks,
  };
}
