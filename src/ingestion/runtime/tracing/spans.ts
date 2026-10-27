import type { AnySpan } from "@mastra/core/observability";
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
  span: AnySpan | undefined = tracing?.root,
) {
  try {
    span?.error({ error: new Error(code), endSpan: false });
  } catch {
    tracing?.diagnose("trace_export_failed");
  }
}
