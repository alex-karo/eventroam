import { SpanType, type AnySpan } from "@mastra/core/observability";
import type { DuckDBStore } from "@mastra/duckdb";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
} from "../../contracts";
import type { SourceSession } from "../../tools/session";
import {
  createRunObservability,
  finishRunObservability,
} from "../observability/runtime";
import { observeTrace, traceFailure } from "./spans";
import { traceUrl, traceReason } from "./labels";

/** Own optional observations; workflow steps and reports hold execution details. */
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
  observeTrace(tracing, tracing.root, {
    name: "catalog-research",
    metadata: {
      ...(engineRunId ? { engineRunId } : {}),
      ...(input.name ? { eventName: input.name } : {}),
    },
  });
  return {
    tracing,
    log: tracing.log,
    failed(code: string) {
      traceFailure(tracing, code);
    },
    async finish(report?: CatalogResearchResult) {
      observeTrace(tracing, tracing.root, {
        name: "catalog-research",
        output: report
          ? {
              researchStatus: report.researchStatus,
              editorStatus: report.editorStatus,
              locationStatus: report.locationStatus,
              outcome: report.outcome,
            }
          : undefined,
      });
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
          name: "readPage",
          input: {
            attemptedUrl: attemptedUrl.url,
            urlTruncated: attemptedUrl.truncated,
          },
          output: {
            ...(finalUrl
              ? { finalUrl: finalUrl.url, urlTruncated: finalUrl.truncated }
              : {}),
            status: read?.status ?? "failed",
            reasonCode: traceReason(read?.reasonCode),
            method: read?.method ?? "unknown",
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
