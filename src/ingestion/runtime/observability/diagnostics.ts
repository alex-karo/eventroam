import { MastraLogger } from "@mastra/core/logger";
import { writeObservabilityStderr } from "./stderr";

export type ObservabilityDiagnostic =
  | "trace_initialization_failed"
  | "trace_export_failed"
  | "trace_flush_failed"
  | "trace_shutdown_failed"
  | "trace_sanitization_failed"
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

export class ObservabilityLogger extends MastraLogger {
  constructor(private readonly failed: () => void) {
    super({ name: "catalog-tracing" });
  }
  debug() {}
  info() {}
  warn() {
    this.failed();
  }
  error() {
    this.failed();
  }
  override trackException() {
    this.failed();
  }
}
