import { SpanType, type AnySpan } from "@mastra/core/observability";
import type { CatalogItemResult } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput, CatalogResearchResult } from "../contracts";
import type { ResearchContext } from "../research/context";
import type { PreparedResearch } from "../research/prepare";
import type { SourceSession } from "../sources/session";
import {
  createRunTracing,
  finishRunTracing,
  observeTrace,
  traceFailure,
} from "./tracing";
import {
  contextEditions,
  committedEditions,
  validatedTraceName,
  runTraceLabel,
  terminalProjection,
  traceResultLabel,
  readProjection,
  type TraceRunState,
} from "./trace-projections";

type Snapshot = {
  phase: string;
  context?: ResearchContext;
  prepared?: PreparedResearch | null;
  applied?: CatalogItemResult | null;
  report?: CatalogResearchResult;
};
/** Owns only trace observations; workflow results and error handling stay with the caller. */
export async function createCatalogRunTrace(
  input: CatalogResearchInput,
  model: string,
  runId: string,
  injected: boolean,
) {
  const tracing = injected
    ? undefined
    : await createRunTracing(input, model, runId);
  if (!tracing) {
    return undefined;
  }
  const snapshot: Snapshot = { phase: "context" };
  const state: TraceRunState = {
    structuralValidation: "not_run",
    targetValidation: "not_run",
    writeState: "not_attempted",
  };
  const update = (values: Partial<Snapshot> = {}) => {
    Object.assign(snapshot, values);
    observeTrace(tracing, tracing.root, () => {
      const catalog = snapshot.context?.catalog ?? [];
      const editions = contextEditions(catalog, input.eventId);
      const mutations = committedEditions(snapshot.applied ?? null, catalog);
      return {
        name: runTraceLabel(
          validatedTraceName(input, catalog, snapshot.prepared ?? null),
          input.mode,
          editions,
          mutations,
          traceResultLabel(state, snapshot.report),
        ),
        entityId: "catalog-research",
        metadata: { phase: snapshot.phase },
        output: terminalProjection(
          state,
          snapshot.report,
          snapshot.applied ?? null,
          editions,
          mutations,
        ),
      };
    });
  };
  update();
  return {
    tracing,
    update,
    state,
    validated(prepared: PreparedResearch) {
      state.structuralValidation = prepared.validation.structural;
      state.targetValidation = prepared.validation.target;
      if (!prepared.candidate) {
        state.errorCode = "validation_failed";
      } else if (prepared.candidate.status === "failed") {
        state.errorCode = "research_failed";
      } else {
        state.writeState = "unchanged";
      }
      update({ prepared });
    },
    failed(code: NonNullable<TraceRunState["errorCode"]>, technical = true) {
      state.errorCode = code;
      if (technical) {
        traceFailure(tracing, code);
      }
    },
    beginWrite() {
      state.writeState = "unknown";
    },
    written(applied: CatalogItemResult) {
      state.writeState = applied.operations.some(
        (operation) => operation.changed,
      )
        ? "committed"
        : "unchanged";
      update({ applied });
    },
    rolledBack() {
      state.writeState = "rolled_back";
      this.failed("write_failed");
    },
    workflowFailed() {
      const codes: Record<string, NonNullable<TraceRunState["errorCode"]>> = {
        context: "context_failed",
        report: "report_failed",
      };
      this.failed(codes[snapshot.phase] ?? "workflow_failed");
    },
    async finish(report?: CatalogResearchResult) {
      update({ report });
      await finishRunTracing(tracing);
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
      span = trace.tracing.root.createChildSpan({
        type: SpanType.GENERIC,
        name: "readSource",
        entityId: "readSource",
      });
    } catch {
      trace.tracing.diagnose("trace_export_failed");
    }
  }
  try {
    await sources.readInitialSource();
  } catch (error) {
    traceFailure(trace?.tracing, "source_failed", span);
    throw error;
  } finally {
    observeTrace(trace?.tracing, span, () =>
      readProjection(sources.initialUrl, sources.reads[0], false),
    );
    try {
      span?.end();
    } catch {
      trace?.tracing.diagnose("trace_export_failed");
    }
  }
}
