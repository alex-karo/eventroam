import { createTool } from "@mastra/core/tools";
import type { ResearchToolContext } from "../contracts";
import { readPageInputSchema, readPageOutputSchema } from "./contracts";
import { boundedToolSource } from "./response";

export function createReadPageTool({
  sources,
  budget,
  modelContext,
  tracing,
  abortSignal,
}: ResearchToolContext) {
  const { readPage: read } = sources;
  const log = tracing?.log;
  return createTool({
    id: "readPage",
    description:
      "Read a specific public page to resolve a missing or conflicting festival fact. Choose a relevant inspected link or discovered URL. Returns Markdown and remaining budget; repeated URLs return cached content, including failures. No writes.",
    inputSchema: readPageInputSchema,
    outputSchema: readPageOutputSchema,
    execute: async ({ url }, toolContext) => {
      const span = toolContext?.tracingContext?.currentSpan;
      const context = {
        ...modelContext(),
        stage: "source",
        ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
        toolCallId: toolContext?.agent?.toolCallId,
      };
      const toolLog = log?.child(context);
      toolLog?.info("Tool call started", {
        tool: "readPage",
        attemptedUrl: url,
      });
      try {
        const cached = sources.isReadCached(url);
        abortSignal?.throwIfAborted();
        const result = await read(url, { ...context, tool: true });
        abortSignal?.throwIfAborted();
        const bounded = boundedToolSource(result);

        toolLog?.[result.status === "ok" ? "info" : "warn"](
          "Tool call finished",
          {
            tool: "readPage",
            attemptedUrl: url,
            response: { status: result.httpStatus, url: result.finalUrl },
            status: result.status,
            method: result.method,
            reasonCode: result.reasonCode,
            sourceCharacters: result.markdown.length,
            truncated: bounded.truncated,
            cached,
            remaining: budget.remaining(),
          },
        );
        const response = { ...bounded, remaining: budget.remaining() };
        return response;
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "readPage",
          attemptedUrl: url,
          errorCode: "source_failed",
        });

        throw error;
      }
    },
  });
}
