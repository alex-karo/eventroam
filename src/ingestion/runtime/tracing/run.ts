import { SpanType, type AnySpan } from "@mastra/core/observability";
import type { DuckDBStore } from "@mastra/duckdb";
import type { CatalogItemResult } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
} from "../../contracts";
import type { ResearchContext } from "../../research/context";
import type { PreparedPlan } from "../../editor/prepare";
import type { SourceSession } from "../../tools/session";
import {
  createRunObservability,
  finishRunObservability,
} from "../observability/runtime";
import { observeTrace, traceFailure } from "./spans";
import {
  boundedEditions,
  contextEditions,
  committedEditions,
  validatedTraceName,
  runTraceLabel,
  traceResultLabel,
  type TraceRunState,
  traceText,
  traceUrl,
  traceReason,
} from "./labels";

type Snapshot = {
  phase: string;
  context?: ResearchContext;
  prepared?: PreparedPlan | null;
  applied?: CatalogItemResult | null;
  report?: CatalogResearchResult;
};
/** Owns optional research observations and their host state; workflow results and error handling stay with the caller. */
export async function createCatalogRunTrace(
  input: CatalogResearchInput,
  model: string,
  runId: string,
  protectedPaths: string[] = [],
  engineRunId?: string,
  sharedStore?: DuckDBStore,
  experimentId?: string,
) {
  const tracing = await createRunObservability(
    input,
    model,
    runId,
    protectedPaths,
    sharedStore,
    experimentId,
  );
  if (!tracing) {
    return undefined;
  }
  const snapshot: Snapshot = { phase: "context" };
  const state: TraceRunState = {
    structuralValidation: "not_run",
    targetValidation: "not_run",
    editorPlanValidation: "not_run",
  };
  const update = (values: Partial<Snapshot> = {}) => {
    Object.assign(snapshot, values);
    try {
      const catalog = snapshot.context?.catalog ?? [];
      const editions = contextEditions(catalog, input.eventId);
      const mutations = committedEditions(snapshot.applied ?? null, catalog);
      observeTrace(tracing, tracing.root, {
        name: runTraceLabel(
          validatedTraceName(input, catalog, snapshot.prepared ?? null),
          input.mode,
          editions,
          mutations,
          traceResultLabel(state, snapshot.report),
        ),
        metadata: {
          phase: snapshot.phase,
          runId,
          ...(engineRunId ? { engineRunId } : {}),
        },
        output: {
          ...(snapshot.report
            ? {
                researchStatus: snapshot.report.researchStatus,
                editorStatus: snapshot.report.editorStatus,
                locationStatus: snapshot.report.locationStatus,
                outcome: snapshot.report.outcome,
                scope: snapshot.report.scope,
                savedEditionCount: snapshot.report.workload.savedEditions,
                returnedEditionCount: snapshot.report.workload.returnedEditions,
              }
            : {}),
          ...state,
          semanticValidation: "not_run",
          editions: {
            context: boundedEditions(editions),
            committed: boundedEditions(mutations),
          },
        },
      });
    } catch {
      tracing.diagnose("trace_export_failed");
    }
  };
  update();
  return {
    tracing,
    update,
    state,
    log: tracing.log,
    validated(prepared: PreparedPlan) {
      state.structuralValidation = prepared.validation.structural;
      state.targetValidation = prepared.validation.target;
      if (!prepared.candidate) {
        state.errorCode = "validation_failed";
      } else if (prepared.candidate.status === "failed") {
        state.errorCode = "research_failed";
      }
      update({ prepared });
    },
    editorValidated(prepared: PreparedPlan) {
      const rejection = prepared.errors.find(
        (error) =>
          error.code === "invalid_plan" || error.code === "editor_rejected",
      );
      state.editorPlanValidation = rejection ? "failed" : "passed";
      if (rejection) {
        state.errorCode =
          rejection.code === "editor_rejected"
            ? "editor_rejected"
            : "validation_failed";
      }
      update({ prepared });
    },
    failed(code: NonNullable<TraceRunState["errorCode"]>, technical = true) {
      state.errorCode = code;
      if (technical) {
        traceFailure(tracing, code);
      }
    },
    workflowFailed() {
      const codes: Record<string, NonNullable<TraceRunState["errorCode"]>> = {
        context: "context_failed",
        report: "report_failed",
      };
      this.failed(codes[snapshot.phase] ?? "workflow_failed");
    },
    terminalFailed(code: "cancelled" | "run_persistence_failed") {
      this.failed(code);
    },
    async finish(report?: CatalogResearchResult) {
      update({ report });
      await finishRunObservability(tracing);
    },
  };
}
export type CatalogRunTrace = NonNullable<
  Awaited<ReturnType<typeof createCatalogRunTrace>>
>;

export async function readInitialWithTrace(
  sources: SourceSession,
  trace?: CatalogRunTrace,
) {
  let span: AnySpan | undefined;
  if (trace && sources.initialUrl) {
    try {
      span = trace.tracing.root?.createChildSpan({
        type: SpanType.GENERIC,
        name: "readPage",
        entityId: "readPage",
      });
    } catch {
      trace.tracing.diagnose("trace_export_failed");
    }
  }
  try {
    await sources.readInitialSource({
      stage: "initial_source",
      traceId: span?.traceId,
      spanId: span?.id,
    });
  } catch (error) {
    traceFailure(trace?.tracing, "source_failed", span);
    throw error;
  } finally {
    if (span && trace && sources.initialUrl) {
      try {
        const read = sources.reads[0];
        const attemptedUrl = traceUrl(sources.initialUrl);
        const finalUrl = read ? traceUrl(read.finalUrl) : undefined;
        observeTrace(trace?.tracing, span, {
          name: traceText(
            `readPage · ${sources.initialUrl} · ${read?.outcome ?? "failed"}:${traceReason(read?.reason)}`,
            512,
          ),
          input: {
            attemptedUrl: attemptedUrl.url,
            urlTruncated: attemptedUrl.truncated,
          },
          output: {
            ...(finalUrl
              ? { finalUrl: finalUrl.url, urlTruncated: finalUrl.truncated }
              : {}),
            outcome: read?.outcome ?? "failed",
            reason: traceReason(read?.reason),
            method: read?.method ?? "unknown",
            completeness: read?.completeness ?? "unknown",
            sourceTruncated:
              read?.sourceTruncated ??
              (read?.reason === "source_content_truncated" ? true : "unknown"),
            toolTruncated: false,
            cached: false,
          },
        });
      } catch {
        trace.tracing.diagnose("trace_export_failed");
      }
    }
    try {
      span?.end();
    } catch {
      trace?.tracing.diagnose("trace_export_failed");
    }
  }
}
