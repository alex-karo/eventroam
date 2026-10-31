import { createTool } from "@mastra/core/tools";
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
      "Find candidate source pages for a query allowed by the research assignment. Results contain URLs and search highlights. Highlights are leads, not verified facts; inspect a destination with readPage before using its facts. Each call uses the shared search budget.",
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
      toolLog?.info("Tool call started", { tool: "searchWeb", query });
      try {
        abortSignal?.throwIfAborted();
        const result = await search(query, { ...context, tool: true });
        abortSignal?.throwIfAborted();

        toolLog?.info("Tool call finished", {
          tool: "searchWeb",
          query,
          status: "ok",
          returnedCount: result.candidates.length,
          candidates: result.candidates.slice(0, 5).map(({ url }) => ({ url })),
          remaining: budget.remaining(),
        });
        const response = { ...result, remaining: budget.remaining() };
        return response;
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "searchWeb",
          query,
          ...classifyModelError(error, Infinity).diagnostic,
          errorCode: "search_failed",
        });

        throw error;
      }
    },
  });
}
