import type { DuckDBStore } from "@mastra/duckdb";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
} from "../../contracts";
import {
  createRunObservability,
  finishRunObservability,
} from "../observability/runtime";
import { observeTrace, traceFailure } from "./spans";

/** Own optional observations; workflow steps and reports hold execution details. */
export async function createCatalogRunTrace(
  input: CatalogResearchInput,
  model: string,
  runId: string,
  protectedPaths: string[] = [],
  engineRunId?: string,
  sharedStore?: DuckDBStore | null,
  experimentId?: string,
) {
  const tracing = await createRunObservability(
    input,
    model,
    runId,
    protectedPaths,
    sharedStore,
    experimentId,
    engineRunId,
  );
  if (!tracing) {
    return undefined;
  }
  observeTrace(tracing, tracing.root, {
    name: "catalog-ingestion",
    metadata: {
      ...(engineRunId ? { engineRunId } : {}),
      scope: input.mode === "refresh" ? (input.scope ?? "full") : null,
    },
  });
  return {
    tracing,
    log: tracing.log,
    setEventName(eventName: string) {
      observeTrace(tracing, tracing.root, {
        name: "catalog-ingestion",
        metadata: { eventName },
      });
    },
    failed(code: string) {
      traceFailure(tracing, code);
    },
    async finish(report?: CatalogResearchResult) {
      observeTrace(tracing, tracing.root, {
        name: "catalog-ingestion",
        metadata: report ? { outcome: report.outcome } : undefined,
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
