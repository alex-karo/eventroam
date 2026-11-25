import type { CatalogAttempt } from "../attempt";
import type { IngestionData } from "../contracts";
import { createCollection } from "../evidence/collection";
import { buildAssignment } from "../roles/assignment";
import { collectResearch } from "../roles/research/agent";
import { validateResearchSummary } from "../roles/research/validate";
import type { StageMetrics } from "../runtime/observability/stage-metrics";
import { createSourceSession, type SourceSession } from "../tools/session";

function sourceErrorCode(source: { status: string; reasonCode?: string }) {
  if (source.status === "unsupported") {
    return "source_unsupported" as const;
  }
  return source.reasonCode?.includes("block")
    ? ("source_blocked" as const)
    : ("source_unavailable" as const);
}

function researchMetrics(
  data: IngestionData,
  sources: SourceSession,
  options: {
    started: number;
    assignedChecks: number;
    cancelled: boolean;
    validSummary: boolean;
  },
): StageMetrics["ingestion_research_finished"] {
  const evidenceSources = new Set(
    data.corpus?.evidence.map(({ sourceId }) => sourceId),
  );
  const checks = options.validSummary
    ? data.research.output?.checks
    : undefined;
  const completed = options.validSummary && data.outcome !== "failed";
  const outcome = completed ? "completed" : "failed";
  return {
    status: options.cancelled ? "cancelled" : outcome,
    duration_ms: Math.round(performance.now() - options.started),
    pages_read: new Set(
      sources.reads
        .filter(({ status }) => status === "ok")
        .map(({ finalUrl }) => finalUrl),
    ).size,
    pages_with_evidence: evidenceSources.size,
    searches_completed: sources.completedSearches,
    assigned_checks: options.assignedChecks,
    ...(checks && {
      returned_checks: checks.length,
      checks_with_evidence: checks.filter(
        ({ blocker, sourceIds }) =>
          !blocker && sourceIds.some((id) => evidenceSources.has(id)),
      ).length,
      blocked_checks: checks.filter(({ blocker }) => blocker).length,
    }),
  };
}

export async function readInitialSource(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
) {
  owned.sources = createSourceSession(
    owned.budget,
    owned.config,
    data.context!.knownLinks,
    owned.deps,
    owned.trace?.log,
  );
  const assignment = buildAssignment(owned.input, data.context!);
  owned.collection = createCollection({
    runId: owned.ingestionRunId,
    startedAt: owned.started,
    sources: owned.sources,
    budget: owned.budget,
    config: owned.config,
    deps: owned.deps,
    assignment: {
      requestedName: assignment.identityContext.requestedName,
      currentDate: assignment.currentDate,
    },
    signal,
    tracing: owned.trace?.tracing,
    captureMetric: owned.captureMetric,
  });
  if (owned.sources.initialUrl) {
    await owned.track(owned.collection.inspectPage(owned.sources.initialUrl));
  }
  return { sources: owned.collection.sources };
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
    captureMetric?.(
      "ingestion_research_finished",
      researchMetrics(data, sources, {
        started,
        assignedChecks: assignment.checks.length,
        cancelled: signal.aborted,
        validSummary,
      }),
    );
  }
}
