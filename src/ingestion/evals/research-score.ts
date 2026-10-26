import { normalizeWireCandidate } from "../research/agent/wire";
import {
  editionSlotNames,
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
    return [data?.previousEdition, data?.currentOrNextEdition]
      .filter((e) => e != null)
      .find((e) => e.key === selector.editionKey);
  }
  if (selector.editionYear !== undefined) {
    return [data?.previousEdition, data?.currentOrNextEdition]
      .filter((e) => e != null)
      .find((e) => e.year?.value === selector.editionYear);
  }
  return data;
}

function checkResearch(item: EvalCase, result: CatalogResearchResult) {
  const expected = item.expectations.research;
  if (!expected) {
    return [
      {
        description: "Catalog outcome must not be failed",
        matched: result.outcome !== "failed",
      },
      {
        description: "Research status must not be failed",
        matched: result.researchStatus !== "failed",
      },
    ];
  }
  const parsed = researchCandidateSchema.safeParse(
    normalizeWireCandidate(result.modelResponse?.object),
  );
  const data = parsed.success ? parsed.data.data : null;
  const checks = [
    {
      description: `researchStatus=${expected.status} with non-failed catalog outcome`,
      matched:
        result.outcome !== "failed" &&
        result.researchStatus === expected.status &&
        parsed.success &&
        parsed.data.status === expected.status,
    },
  ];
  for (const slot of editionSlotNames) {
    if (expected[slot] !== undefined) {
      checks.push({
        description: `${slot}=${expected[slot] ?? "null"}`,
        matched:
          parsed.success && (data?.[slot]?.key ?? null) === expected[slot],
      });
    }
  }
  if (expected.newEditionYear !== undefined) {
    const editions = [data?.previousEdition, data?.currentOrNextEdition].filter(
      (e) => e != null,
    );
    const savedKeys = new Set(
      item.initial.event.editions.map((e) => e.editionKey),
    );
    checks.push({
      description: `one new Edition for year=${expected.newEditionYear}`,
      matched:
        editions.filter((e) => !savedKeys.has(e.key)).length === 1 &&
        editions.some(
          (e) =>
            !savedKeys.has(e.key) && e.year?.value === expected.newEditionYear,
        ),
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
  return checks;
}

function checkFailedResearch(item: EvalCase, result: CatalogResearchResult) {
  const candidate = result.modelResponse?.object;
  const checks = [
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
  if (item.expectations.research?.failureReason === "identity_conflict") {
    checks.push(
      {
        description: "Expected identity conflict to skip editing",
        matched: result.editorStatus === "not_run",
      },
      {
        description: "Expected identity conflict to stop without search",
        matched: result.budget.searches === 0,
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

export function scoreResearch(item: EvalCase, result: CatalogResearchResult) {
  const checks =
    item.expectations.research?.status === "failed"
      ? checkFailedResearch(item, result)
      : checkResearch(item, result);
  return {
    score: checks.filter((check) => check.matched).length / checks.length,
    checks,
  };
}
