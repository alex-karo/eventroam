import { LoggerTransport } from "@mastra/core/logger";
import { EntityType, type AnySpan } from "@mastra/core/observability";
import { PinoLogger } from "@mastra/loggers";
import {
  LoggerContextImpl,
  type DefaultObservabilityInstance,
  type Observability,
} from "@mastra/observability";
import { writeObservabilityStderr } from "../observability/stderr";

export type ResearchLogLevel = "debug" | "info" | "warn" | "error";
export interface ResearchLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ResearchLogger;
}

const priority = { debug: 0, info: 1, warn: 2, error: 3 };

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

/**
 * PinoLogger writes selected records to stderr. The installed logger exports
 * original call arguments without child bindings, so emit one matching Studio
 * event through Mastra's bus with explicit correlation and selected metadata.
 */
export function createResearchLogger(options: {
  native: PinoLogger;
  observability: Observability;
  runId: string;
  eventContext: { eventId?: string };
  level: ResearchLogLevel;
  root?: AnySpan;
  diagnose: (code: "log_write_failed") => void;
}): ResearchLogger {
  const failed = () => options.diagnose("log_write_failed");
  const native = options.native;
  const bus = (
    options.observability.getDefaultInstance() as DefaultObservabilityInstance
  ).getObservabilityBus();
  const base = {
    serviceName: "eventroam-research",
    runId: options.runId,
    ...(options.root
      ? { traceId: options.root.traceId, spanId: options.root.id }
      : {}),
  };

  function bind(context: Record<string, unknown>): ResearchLogger {
    const write = (
      level: ResearchLogLevel,
      message: string,
      fields: Record<string, unknown> = {},
    ) => {
      if (priority[level] < priority[options.level]) {
        return;
      }
      try {
        const data: Record<string, unknown> = {
          ...context,
          ...fields,
          ...options.eventContext,
          runId: options.runId,
        };
        const traceId =
          typeof data.traceId === "string" ? data.traceId : undefined;
        const spanId =
          typeof data.spanId === "string" ? data.spanId : undefined;
        try {
          // One flat set of child bindings keeps native JSON identical to the
          // selected Studio data, including per-call overrides.
          native.child(data)[level](message);
        } catch {
          failed();
        }
        try {
          new LoggerContextImpl({
            observabilityBus: bus,
            correlationContext: {
              runId: options.runId,
              serviceName: "eventroam-research",
              entityType: EntityType.WORKFLOW_RUN,
              entityId: "catalog-research",
              entityName: "Catalog research",
            },
            traceId,
            spanId,
            metadata: { catalogApplicationLog: true },
            minLevel: options.level,
          })[level](message, data);
        } catch {
          failed();
        }
      } catch {
        failed();
      }
    };
    return {
      debug: (message, fields) => write("debug", message, fields),
      info: (message, fields) => write("info", message, fields),
      warn: (message, fields) => write("warn", message, fields),
      error: (message, fields) => write("error", message, fields),
      child(bindings) {
        try {
          const next = { ...context, ...bindings, runId: options.runId };
          return bind(next);
        } catch {
          failed();
          return bind(context);
        }
      },
    };
  }
  return bind(base);
}
