import { randomUUID } from "node:crypto";
import type { DuckDBStore } from "@mastra/duckdb";
import { readSource } from "../../roles/reader/agent";
import { evidenceLimits } from "../../evidence/collection";
import { createResearchBudget, ResearchLimitError } from "../../runtime/budget";
import type { ResearchConfig } from "../../runtime/config";
import {
  createRunObservability,
  finishRunObservability,
} from "../../runtime/observability/runtime";
import { evalDatabasePath } from "../storage";
import { scoreReader, type ReaderEvalCase } from "./index";

export async function executeReaderCase(
  item: ReaderEvalCase,
  todayUtc: string,
  config: ResearchConfig,
  experimentId?: string,
  observabilityStore?: DuckDBStore,
) {
  const runId = `reader-eval-${randomUUID()}`;
  const budget = createResearchBudget(config.limits);
  const limits = evidenceLimits();
  const source = item.reader.source;
  const tracing = await createRunObservability(
    item.input,
    config.model,
    runId,
    [evalDatabasePath()],
    observabilityStore,
    experimentId,
  );
  try {
    if (
      source.markdown.length + limits.inputReserveCharacters >
        limits.pageInputCharacters ||
      limits.readerCalls < 1
    ) {
      throw new ResearchLimitError("context");
    }
    const execution = await readSource({
      input: {
        assignment: {
          requestedName: item.reader.requestedName,
          currentDate: `${todayUtc}T00:00:00.000Z`,
        },
        source: { id: "s1", ...source, markdown: undefined },
        page: source.markdown,
      },
      budget,
      config,
      tracing,
      outputTokens: limits.readerOutputTokens,
      reserveCorrection: () => limits.readerCalls > 1,
    });
    return {
      ...scoreReader(item, execution),
      runId,
      ...(tracing?.root?.traceId ? { traceId: tracing.root.traceId } : {}),
      toolCalls: [],
    };
  } finally {
    await finishRunObservability(tracing);
  }
}
