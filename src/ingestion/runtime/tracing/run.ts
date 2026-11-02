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
