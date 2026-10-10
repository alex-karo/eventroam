import type { AnySpan } from "@mastra/core/observability";
import type { RunObservability } from "../observability/runtime";
import { selectTraceFields, type TraceFields } from "./processor";

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
    selectTraceFields(span, fields);
    span.update({
      name: fields.name,
      input: fields.input,
      output: fields.output,
      metadata: fields.metadata,
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
