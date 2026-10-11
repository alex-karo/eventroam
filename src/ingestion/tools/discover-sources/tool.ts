import { createTool } from "@mastra/core/tools";
import { observeTrace, traceText, traceUrl } from "../../runtime/tracing";
import { classifyModelError } from "../../runtime/model-errors";
import type { ResearchToolContext } from "../contracts";
import {
  discoverSourcesInputSchema,
  discoverSourcesOutputSchema,
} from "./contracts";

export function createDiscoverSourcesTool({
  sources,
  budget,
  modelContext,
  tracing,
  abortSignal,
}: ResearchToolContext) {
  const { discoverSources: search } = sources;
  const log = tracing?.log;
  return createTool({
    id: "discoverSources",
    description:
      "Find source URLs when inspected pages and their relevant links cannot answer a material question. Inspect a destination with readSource before using its facts.",
    inputSchema: discoverSourcesInputSchema,
    outputSchema: discoverSourcesOutputSchema,
    execute: async ({ query }, toolContext) => {
      const span = toolContext?.tracingContext?.currentSpan;
      const context = {
        ...modelContext(),
        stage: "discovery",
        ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
        toolCallId: toolContext?.agent?.toolCallId,
      };
      const toolLog = log?.child(context);
      const started = Date.now();
      toolLog?.info("Tool call started", { tool: "discoverSources", query });
      try {
        abortSignal?.throwIfAborted();
        const result = await search(query, { ...context, tool: true });
        abortSignal?.throwIfAborted();
        observeTrace(tracing, span, {
          name: "discoverSources",
          input: {
            query: traceText(query, 1200),
            queryTruncated: Buffer.byteLength(query) > 1200,
          },
          output: {
            status: "ok",
            returnedCount: result.candidates.length,
            retainedCount: Math.min(result.candidates.length, 5),
            omittedCount: Math.max(0, result.candidates.length - 5),
            candidates: result.candidates
              .slice(0, 5)
              .map(({ url }) => traceUrl(url)),
          },
        });
        toolLog?.info("Tool call finished", {
          tool: "discoverSources",
          query,
          status: "ok",
          returnedCount: result.candidates.length,
          candidates: result.candidates.slice(0, 5).map(({ url }) => ({ url })),
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          modelCostUsd: result.modelCostUsd,
          searchCostUsd: result.searchCostUsd,
          durationMs: Date.now() - started,
          remaining: budget.remaining(),
        });
        return { ...result, remaining: budget.remaining() };
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "discoverSources",
          query,
          ...classifyModelError(error, Infinity).diagnostic,
          errorCode: "search_failed",
          durationMs: Date.now() - started,
        });
        observeTrace(tracing, span, {
          name: "discoverSources",
          input: {
            query: traceText(query, 1200),
            queryTruncated: Buffer.byteLength(query) > 1200,
          },
          output: { status: "failed", errorCode: "search_failed" },
        });
        throw error;
      }
    },
  });
}
