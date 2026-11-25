import type { CatalogAttempt } from "../attempt";
import type { IngestionData } from "../contracts";
import { buildAssignment } from "../roles/assignment";
import { collectResearch } from "../roles/research/agent";
import { validateResearchSummary } from "../roles/research/validate";

function sourceErrorCode(source: { status: string; reasonCode?: string }) {
  if (source.status === "unsupported") {
    return "source_unsupported" as const;
  }
  return source.reasonCode?.includes("block")
    ? ("source_blocked" as const)
    : ("source_unavailable" as const);
}

export async function collectSourceEvidence(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
) {
  const { collection, sources, captureMetric } = owned;
  if (!collection || !sources) {
    return null;
  }
  const started = performance.now();
  const assignment = buildAssignment(owned.input, data.context!);
  let validSummary = false;
  try {
    try {
      data.research = await owned.track(
        collectResearch({
          budget: owned.budget,
          config: owned.config,
          deps: owned.deps,
          tracing: owned.trace?.tracing,
          assignment,
          collection,
          sourceSession: sources,
        }),
      );
    } finally {
      data.corpus = await collection.freeze();
    }
    data.errors.push(...data.research.errors, ...collection.errors);
    data.unresolved.push(...(data.research.output?.unresolved ?? []));
    data.unresolved.push(
      ...(data.research.output?.checks ?? []).flatMap((check) =>
        check.blocker ? [{ message: `${check.check}: ${check.blocker}` }] : [],
      ),
    );
    if (
      collection.fatal ||
      data.research.status !== "success" ||
      !data.corpus.evidence.length
    ) {
      data.outcome = "failed";
    }
    for (const source of data.corpus.sources) {
      if (source.status !== "ok") {
        data.errors.push({
          code: sourceErrorCode(source),
          stage: "source",
          url: source.attemptedUrl,
          message: `Source retrieval ${source.reasonCode ?? source.status}`,
        });
      }
    }
    const invalidSummary = validateResearchSummary(
      data.research.output,
      data.corpus.sources,
    );
    if (invalidSummary) {
      data.errors.push(invalidSummary);
      data.outcome = "failed";
    }
    validSummary = data.research.status === "success" && !invalidSummary;
    return {
      collection: data.research,
      sources: data.corpus.sources,
      corpusVersion: data.corpus.version,
    };
  } finally {
    if (captureMetric) {
      const { reads, discovery } = sources;
      const evidenceSources = new Set(
        data.corpus?.evidence.map(({ sourceId }) => sourceId),
      );
      const checks = validSummary ? data.research.output?.checks : undefined;
      const completed = validSummary && data.outcome !== "failed";
      const outcome = completed ? "completed" : "failed";
      captureMetric("ingestion_research_finished", {
        status: signal.aborted ? "cancelled" : outcome,
        duration_ms: Math.round(performance.now() - started),
        pages_read: new Set(
          reads
            .filter(({ status }) => status === "ok")
            .map(({ finalUrl }) => finalUrl),
        ).size,
        pages_with_evidence: evidenceSources.size,
        searches_completed: discovery.length,
        assigned_checks: assignment.checks.length,
        ...(checks && {
          returned_checks: checks.length,
          checks_with_evidence: checks.filter(
            ({ blocker, sourceIds }) =>
              !blocker && sourceIds.some((id) => evidenceSources.has(id)),
          ).length,
          blocked_checks: checks.filter(({ blocker }) => blocker).length,
        }),
      });
    }
  }
}
