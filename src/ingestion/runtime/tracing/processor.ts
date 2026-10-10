import {
  SpanType,
  type AnySpan,
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

type Usage = Record<string, unknown>;
function tokenUsage(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const usage = value as Usage;
  const number = (key: string) =>
    typeof usage[key] === "number" && Number.isFinite(usage[key])
      ? usage[key]
      : undefined;
  return {
    inputTokens: number("inputTokens"),
    outputTokens: number("outputTokens"),
    cacheRead: number("cacheRead"),
    cacheWrite: number("cacheWrite"),
    reasoning: number("reasoning"),
  };
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
        const attrs = span.attributes as Record<string, unknown> | undefined;
        const usage = tokenUsage(attrs?.usage);
        const attributes: Record<string, unknown> = {};
        if (usage) {
          attributes.usage = usage;
        }
        if (typeof attrs?.success === "boolean") {
          attributes.success = attrs.success;
        }
        if (typeof attrs?.finishReason === "string") {
          attributes.finishReason = attrs.finishReason;
        }
        if (typeof span.type !== "string" || typeof span.name !== "string") {
          throw new Error("Invalid span");
        }
        if (!Object.values(SpanType).includes(span.type)) {
          span.type = SpanType.GENERIC;
        }
        const tool = ["readSource", "discoverSources"].find(
          (name) => span.entityId === name,
        );
        span.name =
          explicit?.name ??
          (span.type === SpanType.AGENT_RUN
            ? "Festival research"
            : (tool ?? span.type));
        if (span.entityId !== "catalog-research") {
          span.entityId =
            span.type === SpanType.AGENT_RUN ? "festival-research" : tool;
        }
        span.entityType = undefined;
        span.entityName = span.name;
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
