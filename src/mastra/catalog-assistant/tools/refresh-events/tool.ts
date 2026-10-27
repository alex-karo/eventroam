import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ResearchLogger } from "../../../../ingestion/runtime/logging";
import { studioIngestionResultSchema } from "../../../../ingestion/workflow";
import {
  refreshConsumedKey,
  trustedConversation,
} from "../../execution-context";
import { queryCatalog } from "../query-catalog/query";
import { startToolLog, type AssistantLogging } from "../../logging";
import {
  refreshInputSchema,
  type RefreshRun,
  type RefreshWorkflow,
} from "./contracts";

export function createRefreshEventsTool(
  catalogPath: () => string,
  workflow: RefreshWorkflow,
  logging?: AssistantLogging,
) {
  const activeConversations = new Set<string>();
  return createTool({
    id: "refresh_events",
    description:
      "Refresh one to three existing Events after an owner request. dryRun defaults to preview; false applies. One selection per execution. Read saved reports through query_catalog.",
    inputSchema: refreshInputSchema,
    execute: async (input, context) => {
      const call = startToolLog(logging, "refresh_events", context, {
        eventIds: input.eventIds,
        scope: input.scope,
        dryRun: input.dryRun,
      });
      try {
        const requestContext = context?.requestContext;
        const conversation = trustedConversation(requestContext);
        if (!conversation) {
          return call.finish({ ok: false, error: "host_context_required" });
        }
        if (context?.abortSignal?.aborted) {
          return call.finish({ ok: false, error: "cancelled" });
        }
        const selected = queryCatalog(catalogPath(), {
          sql: `SELECT id FROM events WHERE id IN (${input.eventIds.map(() => "?").join(",")})`,
          parameters: input.eventIds,
        });
        if (!selected.ok || selected.rowCount !== input.eventIds.length) {
          return call.finish({ ok: false, error: "invalid_selection" });
        }
        // No await between these checks and acquisition: parallel calls share the flag.
        if (requestContext.get(refreshConsumedKey) !== false) {
          return call.finish({ ok: false, error: "selection_consumed" });
        }
        if (activeConversations.has(conversation)) {
          return call.finish({ ok: false, error: "conversation_busy" });
        }
        requestContext.set(refreshConsumedKey, true);
        activeConversations.add(conversation);
        const results: RefreshEventResult[] = [];
        try {
          for (const eventId of input.eventIds) {
            if (context?.abortSignal?.aborted) {
              break;
            }
            const result = await refreshOneEvent(
              eventId,
              input,
              workflow,
              context?.abortSignal,
              call.log,
            );
            if (!result) {
              break;
            }
            results.push(result);
          }
          const failedCount = results.filter(
            ({ error, result }) =>
              error ||
              result?.persistenceStatus === "failed" ||
              result?.errorCodes.length,
          ).length;
          const cancelled = context?.abortSignal?.aborted ?? false;
          return call.finish(
            {
              ok: true,
              mode: "refresh" as const,
              scope: input.scope,
              dryRun: input.dryRun,
              cancelled,
              results,
            },
            { completedCount: results.length, failedCount, cancelled },
            failedCount > 0,
          );
        } finally {
          activeConversations.delete(conversation);
        }
      } catch (error) {
        call.finish({ ok: false, error: "execution_failed" });
        throw error;
      }
    },
  });
}

type RefreshEventResult = {
  eventId: string;
  result?: z.infer<typeof studioIngestionResultSchema>;
  engineRunId?: string;
  error?: string;
};

async function refreshOneEvent(
  eventId: string,
  input: Pick<z.output<typeof refreshInputSchema>, "scope" | "dryRun">,
  workflow: RefreshWorkflow,
  signal: AbortSignal | undefined,
  log: ResearchLogger | undefined,
): Promise<RefreshEventResult | undefined> {
  let run: RefreshRun | undefined;
  let cancellation: Promise<unknown> | undefined;
  const cancel = () => {
    cancellation ??= run!.cancel().catch(() => undefined);
  };
  try {
    run = await workflow.createRun();
    if (signal?.aborted) {
      return;
    }
    signal?.addEventListener("abort", cancel, { once: true });
    const output = await run.start({
      inputData: {
        mode: "refresh",
        eventId,
        scope: input.scope,
        dryRun: input.dryRun,
        republish: false,
      },
    });
    const result = readWorkflowSummary(output);
    const failed =
      !result ||
      result.persistenceStatus === "failed" ||
      result.errorCodes.length > 0;
    log?.[failed ? "error" : "info"]("Assistant refresh result", {
      eventId,
      engineRunId: result?.engineRunId ?? run.runId,
      ...(result
        ? {
            ingestionRunId: result.ingestionRunId,
            outcome: result.outcome,
            persistenceStatus: result.persistenceStatus,
            changedCount: result.changedCount,
            errorCodes: result.errorCodes,
          }
        : { errorCode: "no_result" }),
    });
    return result
      ? { eventId, result }
      : { eventId, engineRunId: run.runId, error: "no_result" };
  } catch {
    log?.error("Assistant refresh result", {
      eventId,
      engineRunId: run?.runId,
      errorCode: "execution_failed",
    });
    return {
      eventId,
      ...(run && { engineRunId: run.runId }),
      error: "execution_failed",
    };
  } finally {
    signal?.removeEventListener("abort", cancel);
    await cancellation;
  }
}

function readWorkflowSummary(output: unknown) {
  const completed = z
    .object({ result: studioIngestionResultSchema })
    .safeParse(output);
  if (completed.success) {
    return completed.data.result;
  }
  const failed = z
    .object({
      status: z.literal("failed"),
      error: z.object({ message: z.string() }),
    })
    .safeParse(output);
  if (!failed.success) {
    return;
  }
  // Finalization can fail after catalog writes. Retain only its safe summary.
  try {
    const failure = z
      .object({
        code: z.literal("run_persistence_failed"),
        summary: studioIngestionResultSchema,
      })
      .safeParse(JSON.parse(failed.data.error.message));
    return failure.success ? failure.data.summary : undefined;
  } catch {
    return;
  }
}
