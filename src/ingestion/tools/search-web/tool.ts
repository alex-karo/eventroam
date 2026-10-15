import { createTool } from "@mastra/core/tools";
import { observeTrace, traceText, traceUrl } from "../../runtime/tracing";
import { classifyModelError } from "../../runtime/model-errors";
import type { ResearchToolContext } from "../contracts";
import { searchWebInputSchema, searchWebOutputSchema } from "./contracts";

export function createSearchWebTool({
  sources,
  budget,
  modelContext,
  tracing,
  abortSignal,
}: ResearchToolContext) {
  const { searchWeb: search } = sources;
  const log = tracing?.log;
  return createTool({
    id: "searchWeb",
    description:
      "Find sources only when no official source is known, it is inaccessible or wrong, or known sources conflict materially with the original event identity/dates or each other. Use known links and prior results first. Once resolved, an issue no longer justifies further searches. Missing announcements or fields alone do not justify search. Highlights are leads; verify facts with readPage.",
    inputSchema: searchWebInputSchema,
    outputSchema: searchWebOutputSchema,
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
      toolLog?.info("Tool call started", { tool: "searchWeb", query });
      try {
        abortSignal?.throwIfAborted();
        const result = await search(query, { ...context, tool: true });
        abortSignal?.throwIfAborted();
        observeTrace(tracing, span, {
          name: "searchWeb",
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
          tool: "searchWeb",
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
          tool: "searchWeb",
          query,
          ...classifyModelError(error, Infinity).diagnostic,
          errorCode: "search_failed",
          durationMs: Date.now() - started,
        });
        observeTrace(tracing, span, {
          name: "searchWeb",
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
