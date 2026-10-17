import {
  SpanType,
  type AnySpan,
  type ModelGenerationAttributes,
  type SpanOutputProcessor,
} from "@mastra/core/observability";
import type { CatalogResearchInput } from "../../contracts";
import type { Diagnose } from "../observability/diagnostics";

export type TraceFields = {
  name: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
};
export type TraceMetadata = {
  runId?: string;
  mode: CatalogResearchInput["mode"];
  eventId?: string;
  model: string;
  promptVersion: string;
};

// SDK tool spans replace output after execute returns. Keep only our explicit
// selections across their lifecycle; the weak keys disappear with the spans.
const selectedFields = new WeakMap<AnySpan, TraceFields>();
export function selectTraceFields(span: AnySpan, fields: TraceFields) {
  selectedFields.set(span, fields);
}

/** Remove SDK-generated content; only fields chosen by our producers are exported. */
export function researchSpanProcessor(
  metadata: TraceMetadata,
  diagnose: Diagnose,
): SpanOutputProcessor {
  return {
    name: "catalog-content-exclusions",
    process(span?: AnySpan) {
      if (!span) {
        return undefined;
      }
      try {
        const explicit = selectedFields.get(span);
        const attrs: ModelGenerationAttributes & {
          success?: boolean;
          usageIncomplete?: boolean;
        } = span.attributes ?? {};
        const attributes = {
          usage: attrs.usage,
          provider: attrs.provider,
          model: attrs.model,
          responseModel: attrs.responseModel,
          costContext: attrs.costContext,
          usageIncomplete: attrs.usageIncomplete,
          success: attrs.success,
          finishReason: attrs.finishReason,
        };
        const operationName =
          span.type === SpanType.AGENT_RUN || span.type === SpanType.TOOL_CALL
            ? (span.entityName ?? span.type)
            : span.type;
        span.name = explicit?.name ?? operationName;
        span.entityName = explicit?.name ?? span.entityName;
        span.attributes = attributes;
        span.metadata = { ...metadata, ...explicit?.metadata };
        span.input = explicit?.input;
        span.output = explicit?.output;
        span.requestContext = undefined;
        span.tags = undefined;
        span.errorInfo = span.errorInfo
          ? { message: "operation_failed" }
          : undefined;
        return span;
      } catch {
        diagnose("trace_sanitization_failed");
        // An exception would let the SDK export the original unsafe payload.
        return undefined;
      }
    },
    async shutdown() {},
  };
}
