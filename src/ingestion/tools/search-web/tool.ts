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
  capture,
}: ResearchToolContext) {
  const { searchWeb: search } = sources;
  const log = tracing?.log;
  return createTool({
    id: "searchWeb",
    description:
      "Find candidate source pages for a query allowed by the research assignment. Results contain URLs and search highlights. Highlights are leads, not verified facts; inspect a destination with readPage before using its facts. Each call uses the shared search budget.",
    inputSchema: searchWebInputSchema,
    outputSchema: searchWebOutputSchema,
    execute: async ({ query }, toolContext) => {
      const sequence = capture?.reserve();
      const span = toolContext?.tracingContext?.currentSpan;
      const context = {
        ...modelContext(),
        stage: "discovery",
        ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
        toolCallId: toolContext?.agent?.toolCallId,
      };
      const toolLog = log?.child(context);
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
          remaining: budget.remaining(),
        });
        const response = { ...result, remaining: budget.remaining() };
        if (sequence !== undefined) {
          capture?.save(sequence, "searchWeb", response, context.toolCallId);
        }
        return response;
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "searchWeb",
          query,
          ...classifyModelError(error, Infinity).diagnostic,
          errorCode: "search_failed",
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
