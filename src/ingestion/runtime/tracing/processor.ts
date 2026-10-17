import {
  EntityType,
  SpanType,
  type AnySpan,
  type ModelGenerationAttributes,
  type SpanOutputProcessor,
  type UsageStats,
} from "@mastra/core/observability";
import {
  knownEntity,
  nonnegative,
  safeCostContext,
  technicalId,
} from "../observability/fields";
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

function tokenUsage(usage: UsageStats | undefined): UsageStats | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens: nonnegative(usage.inputTokens),
    outputTokens: nonnegative(usage.outputTokens),
    inputDetails: usage.inputDetails && {
      text: nonnegative(usage.inputDetails.text),
      cacheRead: nonnegative(usage.inputDetails.cacheRead),
      cacheWrite: nonnegative(usage.inputDetails.cacheWrite),
      cacheWrite5m: nonnegative(usage.inputDetails.cacheWrite5m),
      cacheWrite1h: nonnegative(usage.inputDetails.cacheWrite1h),
      audio: nonnegative(usage.inputDetails.audio),
      image: nonnegative(usage.inputDetails.image),
    },
    outputDetails: usage.outputDetails && {
      text: nonnegative(usage.outputDetails.text),
      reasoning: nonnegative(usage.outputDetails.reasoning),
      audio: nonnegative(usage.outputDetails.audio),
      image: nonnegative(usage.outputDetails.image),
    },
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
        const attrs: ModelGenerationAttributes & {
          success?: boolean;
          usageIncomplete?: boolean;
        } = span.attributes ?? {};
        const usage = tokenUsage(attrs?.usage);
        const attributes: Record<string, unknown> = {};
        if (usage) {
          attributes.usage = usage;
        }
        attributes.provider = technicalId(attrs?.provider);
        attributes.model = technicalId(attrs?.model);
        attributes.responseModel = technicalId(attrs?.responseModel);
        attributes.costContext = safeCostContext(attrs?.costContext);
        if (typeof attrs?.usageIncomplete === "boolean") {
          attributes.usageIncomplete = attrs.usageIncomplete;
        }
        if (typeof attrs?.success === "boolean") {
          attributes.success = attrs.success;
        }
        if (
          [
            "stop",
            "length",
            "content-filter",
            "tool-calls",
            "error",
            "other",
            "unknown",
          ].includes(attrs?.finishReason ?? "")
        ) {
          attributes.finishReason = attrs?.finishReason;
        }
        if (typeof span.type !== "string" || typeof span.name !== "string") {
          throw new Error("Invalid span");
        }
        if (!Object.values(SpanType).includes(span.type)) {
          span.type = SpanType.GENERIC;
        }
        const known = knownEntity(span.entityId);
        const agent =
          known?.entityType === EntityType.AGENT
            ? known
            : knownEntity("festival-research")!;
        const operationName =
          known?.entityType === EntityType.TOOL ? known.entityName : span.type;
        span.name =
          explicit?.name ??
          (span.type === SpanType.AGENT_RUN ? agent.entityName : operationName);
        const entity =
          known ?? (span.type === SpanType.AGENT_RUN ? agent : undefined);
        span.entityId = entity?.entityId;
        span.entityType = entity?.entityType;
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
