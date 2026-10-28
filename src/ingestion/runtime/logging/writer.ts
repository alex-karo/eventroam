import { LoggerTransport } from "@mastra/core/logger";
import type { CorrelationContext } from "@mastra/core/observability";
import { PinoLogger } from "@mastra/loggers";
import { writeObservabilityStderr } from "../observability/stderr";

export type ResearchLogLevel = "debug" | "info" | "warn" | "error";
export function researchLogLevel(enabled: boolean): ResearchLogLevel {
  const level = enabled
    ? process.env.CATALOG_LOG_LEVEL?.trim() || "info"
    : "info";
  if (!["debug", "info", "warn", "error"].includes(level)) {
    throw new Error("Invalid log level");
  }
  return level as ResearchLogLevel;
}

export interface ResearchLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ResearchLogger;
}

/** Route native Pino records through the same EPIPE-safe stderr writer as diagnostics. */
class StderrTransport extends LoggerTransport {
  constructor(private readonly failed: () => void) {
    super();
  }
  override _transform(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    writeObservabilityStderr(String(chunk), this.failed);
    callback();
  }
}

/** Shared native logger for Mastra diagnostics and application output. */
export function createPinoLogger(
  level: ResearchLogLevel,
  failed: () => void,
): PinoLogger {
  return new PinoLogger({
    name: "eventroam-research",
    level,
    overrideDefaultTransports: true,
    transports: { default: new StderrTransport(failed) },
  });
}

/** Pass bound fields as call data so native Pino export retains them. */
export function createApplicationLogger(options: {
  native: PinoLogger;
  runId?: string;
  eventContext?: { eventId?: string };
  correlationContext?: CorrelationContext;
  diagnose: (code: "log_write_failed") => void;
}): ResearchLogger {
  function bind(context: Record<string, unknown>): ResearchLogger {
    const write = (
      level: ResearchLogLevel,
      message: string,
      fields: Record<string, unknown> = {},
    ) => {
      try {
        options.native[level](message, {
          ...context,
          ...fields,
          ...options.eventContext,
          runId: options.runId,
        });
      } catch {
        options.diagnose("log_write_failed");
      }
    };
    return {
      debug: (message, fields) => write("debug", message, fields),
      info: (message, fields) => write("info", message, fields),
      warn: (message, fields) => write("warn", message, fields),
      error: (message, fields) => write("error", message, fields),
      child: (bindings) => bind({ ...context, ...bindings }),
    };
  }
  return bind({ ...options.correlationContext });
}
