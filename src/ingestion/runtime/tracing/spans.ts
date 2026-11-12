import type { AnySpan } from "@mastra/core/observability";
import { getErrorFromUnknown } from "@mastra/core/error";
import type { RunObservability } from "../observability/runtime";
export type TraceFields = {
  name: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
};

/** Trace failures never change ingestion results. */
export function observeTrace(
  tracing: RunObservability | undefined,
  span: AnySpan | undefined,
  fields: TraceFields,
) {
  if (!tracing || !span) {
    return;
  }
  try {
    span.update({
      name: fields.name,
      input: fields.input,
      output: fields.output,
      metadata: { ...span.metadata, ...fields.metadata },
    });
  } catch {
    tracing.diagnose("trace_export_failed");
  }
}

export function traceFailure(
  tracing: RunObservability | undefined,
  code: string,
  options: {
    span?: AnySpan;
    error?: unknown;
    metadata?: Record<string, unknown>;
  } = {},
) {
  try {
    const span = options.span ?? tracing?.root;
    // A later summary must not replace an observed cause.
    if (!span || (options.error === undefined && span.errorInfo)) {
      return;
    }
    span.error({
      error: getErrorFromUnknown(options.error, {
        fallbackMessage: code,
        supportSerialization: false,
      }),
      metadata: { failure: { code, ...options.metadata } },
      endSpan: false,
    });
  } catch {
    tracing?.diagnose("trace_export_failed");
  }
}
