import { MastraLogger } from "@mastra/core/logger";
import { EntityType } from "@mastra/core/observability";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { Observability, SamplingStrategyType } from "@mastra/observability";
import {
  createApplicationLogger,
  createPinoLogger,
  type ResearchLogLevel,
  type ResearchLogger,
} from "../../ingestion/runtime/logging";
import { createDiagnostics } from "../../ingestion/runtime/observability/diagnostics";
import { ResearchObservabilityExporter } from "../../ingestion/runtime/observability/runtime";

/** SDK messages can contain prompts and tool data. Keep only safe diagnostics. */
class StudioSdkLogger extends MastraLogger {
  constructor(
    private readonly native: ReturnType<typeof createPinoLogger>,
    private readonly failed: () => void,
  ) {
    super({ name: "catalog-studio" });
  }
  debug() {}
  info() {}
  warn() {
    this.write("warn");
  }
  error() {
    this.write("error");
  }
  override trackException() {
    this.error();
  }
  private write(level: "warn" | "error") {
    try {
      this.native[level]("Studio SDK diagnostic");
    } catch {
      this.failed();
    }
  }
}

/** Studio owns the store. Assistant logging adds no chat spans or metrics. */
export function createAssistantLogging() {
  if (process.env.CATALOG_LOGGING !== "true") {
    return;
  }
  const diagnose = createDiagnostics();
  try {
    const level = process.env.CATALOG_LOG_LEVEL?.trim() || "info";
    if (!["debug", "info", "warn", "error"].includes(level)) {
      throw new Error("Invalid log level");
    }
    const failed = () => diagnose("log_write_failed");
    const native = createPinoLogger(level as ResearchLogLevel, failed);
    return {
      native,
      sdk: new StudioSdkLogger(native, failed),
      observability: new Observability({
        sensitiveDataFilter: false,
        configs: {
          assistant: {
            serviceName: "eventroam-research",
            sampling: { type: SamplingStrategyType.NEVER },
            logging: { enabled: true, level: level as ResearchLogLevel },
            exporters: [new ResearchObservabilityExporter(diagnose)],
          },
        },
      }),
      level: level as ResearchLogLevel,
      diagnose,
    };
  } catch {
    diagnose("trace_initialization_failed");
  }
}

export type AssistantLogging = ReturnType<typeof createAssistantLogging>;

export function startToolLog(
  logging: AssistantLogging,
  toolName: string,
  context: ToolExecutionContext | undefined,
  fields: Record<string, unknown> = {},
) {
  const started = performance.now();
  let log: ResearchLogger | undefined;
  try {
    log =
      logging &&
      createApplicationLogger({
        ...logging,
        runId:
          context?.tracingContext?.currentSpan?.getCorrelationContext?.()
            ?.runId,
        root: context?.tracingContext?.currentSpan,
        correlationContext: {
          entityType: EntityType.AGENT,
          entityId: "catalog-assistant",
          entityName: "Catalog assistant",
          threadId: context?.agent?.threadId,
          resourceId: context?.agent?.resourceId,
        },
      }).child({
        agentId: "catalog-assistant",
        toolName,
        toolCallId: context?.agent?.toolCallId,
        ...fields,
      });
  } catch {
    logging?.diagnose("log_write_failed");
  }
  log?.info("Assistant tool started");
  return {
    log,
    finish<T extends { ok: boolean; error?: string }>(
      result: T,
      details: Record<string, unknown> = {},
      failed = false,
    ): T {
      let level: ResearchLogLevel = !result.ok || failed ? "error" : "info";
      if (result.error === "cancelled" || details.cancelled) {
        level = "warn";
      }
      log?.[level]("Assistant tool completed", {
        ok: result.ok,
        ...(result.error && { errorCode: result.error }),
        ...details,
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    },
  };
}
