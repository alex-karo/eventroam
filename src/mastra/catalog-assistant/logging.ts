import { EntityType } from "@mastra/core/observability";
import type { ToolExecutionContext } from "@mastra/core/tools";
import {
  createApplicationLogger,
  createPinoLogger,
  researchLogLevel,
  type ResearchLogLevel,
  type ResearchLogger,
} from "../../ingestion/runtime/logging";
import { createDiagnostics } from "../../ingestion/runtime/observability/diagnostics";
import { createCatalogObservability } from "../../ingestion/runtime/observability/runtime";

/** Studio owns the store. Assistant logging adds no chat spans or metrics. */
export function createAssistantLogging() {
  if (process.env.CATALOG_LOGGING !== "true") {
    return;
  }
  const diagnose = createDiagnostics();
  try {
    const level = researchLogLevel(true);
    const failed = () => diagnose("log_write_failed");
    const native = createPinoLogger(level, failed);
    return {
      native,
      observability: createCatalogObservability({
        traceEnabled: false,
        loggingEnabled: true,
        level,
      }),
      level,
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
        correlationContext: {
          entityType: EntityType.AGENT,
          entityId: context?.agent?.agentId ?? "catalog-assistant",
          entityName: context?.agent?.agentId ?? "Catalog assistant",
          threadId: context?.agent?.threadId,
          resourceId: context?.agent?.resourceId,
        },
      }).child({
        agentId: context?.agent?.agentId ?? "catalog-assistant",
        toolName,
        toolCallId: context?.agent?.toolCallId,
        ...fields,
      });
  } catch {
    logging?.diagnose("log_write_failed");
  }
  log?.info("Assistant tool started");
  return {
    finish<T extends { ok: boolean; error?: string }>(
      result: T,
      details: Record<string, unknown> = {},
    ): T {
      let level: ResearchLogLevel = result.ok ? "info" : "error";
      if (result.error === "cancelled") {
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
