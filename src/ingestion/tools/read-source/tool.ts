import { createTool } from "@mastra/core/tools";
import { observeTrace, traceUrl } from "../../runtime/tracing";
import type { ResearchToolContext } from "../contracts";
import { readSourceInputSchema, readSourceOutputSchema } from "./contracts";
import { boundedToolSource } from "./response";

export function createReadSourceTool({
  sources,
  budget,
  modelContext,
  tracing,
  abortSignal,
}: ResearchToolContext) {
  const { readSource: read } = sources;
  const log = tracing?.log;
  return createTool({
    id: "readSource",
    description:
      "Read a specific public page to resolve a missing or conflicting festival fact. Choose a relevant inspected link or discovered URL. Returns Markdown and remaining budget; repeated URLs return cached content, including failures. No writes.",
    inputSchema: readSourceInputSchema,
    outputSchema: readSourceOutputSchema,
    execute: async ({ url }, toolContext) => {
      const span = toolContext?.tracingContext?.currentSpan;
      const context = {
        ...modelContext(),
        stage: "source",
        ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
        toolCallId: toolContext?.agent?.toolCallId,
      };
      const toolLog = log?.child(context);
      const started = Date.now();
      toolLog?.info("Tool call started", {
        tool: "readSource",
        attemptedUrl: url,
      });
      try {
        const cached = sources.isReadCached(url);
        abortSignal?.throwIfAborted();
        const result = await read(url, { ...context, tool: true });
        abortSignal?.throwIfAborted();
        const bounded = boundedToolSource(result);
        observeTrace(tracing, span, {
          name: "readSource",
          input: {
            attemptedUrl: traceUrl(url).url,
            urlTruncated: traceUrl(url).truncated,
          },
          output: {
            finalUrl: traceUrl(result.finalUrl).url,
            urlTruncated: traceUrl(result.finalUrl).truncated,
            outcome: result.outcome,
            method: result.method,
            reason: result.reason,
            completeness: result.completeness,
            httpStatus: result.httpStatus,
            sourceCharacters: result.markdown.length,
            sourceTruncated: result.sourceTruncated,
            toolTruncated: bounded.truncated,
            cached,
          },
        });
        toolLog?.[result.outcome === "ok" ? "info" : "warn"](
          "Tool call finished",
          {
            tool: "readSource",
            attemptedUrl: url,
            response: { status: result.httpStatus, url: result.finalUrl },
            outcome: result.outcome,
            method: result.method,
            reason: result.reason,
            completeness: result.completeness,
            sourceCharacters: result.markdown.length,
            sourceTruncated: result.sourceTruncated,
            toolTruncated: bounded.truncated,
            cached,
            durationMs: Date.now() - started,
            remaining: budget.remaining(),
          },
        );
        return { ...bounded, remaining: budget.remaining() };
      } catch (error) {
        toolLog?.warn("Tool call failed", {
          tool: "readSource",
          attemptedUrl: url,
          errorCode: "source_failed",
          durationMs: Date.now() - started,
        });
        observeTrace(tracing, span, {
          name: "readSource",
          input: {
            attemptedUrl: traceUrl(url).url,
            urlTruncated: traceUrl(url).truncated,
          },
          output: { outcome: "failed" },
        });
        throw error;
      }
    },
  });
}
