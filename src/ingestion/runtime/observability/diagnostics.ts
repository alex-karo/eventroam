import { writeObservabilityStderr } from "./stderr";

export type ObservabilityDiagnostic =
  | "trace_initialization_failed"
  | "trace_export_failed"
  | "trace_flush_failed"
  | "trace_shutdown_failed"
  | "log_write_failed";
export type Diagnose = (code: ObservabilityDiagnostic) => void;
/** No SDK message, error or event payload reaches stderr. Bound repeats per run. */
export function createDiagnostics(): Diagnose {
  const seen = new Set<ObservabilityDiagnostic>();
  return (code) => {
    if (seen.has(code)) {
      return;
    }
    seen.add(code);
    writeObservabilityStderr(`${code}\n`);
  };
}
