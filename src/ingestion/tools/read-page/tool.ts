import { createTool } from "@mastra/core/tools";
import { observeTrace, traceUrl } from "../../runtime/tracing";
import type { ResearchToolContext } from "../contracts";
import { readPageInputSchema, readPageOutputSchema } from "./contracts";
import { boundedToolSource } from "./response";

export function createReadPageTool({
  sources,
  budget,
  modelContext,
  tracing,
  abortSignal,
  capture,
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
      const sequence = capture?.reserve();
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
        observeTrace(tracing, span, {
          name: "readPage",
          input: {
            attemptedUrl: traceUrl(url).url,
            urlTruncated: traceUrl(url).truncated,
          },
          output: {
            finalUrl: traceUrl(result.finalUrl).url,
            urlTruncated: traceUrl(result.finalUrl).truncated,
            status: result.status,
            method: result.method,
            reasonCode: result.reasonCode,
            httpStatus: result.httpStatus,
            sourceCharacters: result.markdown.length,
            truncated: bounded.truncated,
            cached,
          },
        });
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
        if (sequence !== undefined) {
          capture?.save(sequence, "readPage", response, context.toolCallId);
        }
        return response;
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "readPage",
          attemptedUrl: url,
          errorCode: "source_failed",
        });
        observeTrace(tracing, span, {
          name: "readPage",
          input: {
            attemptedUrl: traceUrl(url).url,
            urlTruncated: traceUrl(url).truncated,
          },
          output: { status: "failed" },
        });
        throw error;
      }
    },
  });
}
