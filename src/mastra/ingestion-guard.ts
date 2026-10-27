import type { MiddlewareHandler } from "hono";
import type { createCatalogIngestionWorkflow } from "../ingestion/workflow";
import type { MastraCompositeStore } from "@mastra/core/storage";
import { WorkflowHistoryError } from "../ingestion/runtime/workflow-storage";

/** Guard all native execution variants before they allocate an attempt. */
export function ingestionExecutionGuard(
  control: ReturnType<typeof createCatalogIngestionWorkflow>["historyControl"],
  storage: MastraCompositeStore,
): MiddlewareHandler {
  return async (context, next) => {
    const path = context.req.path;
    if (
      !path.startsWith("/api/workflows/catalog-ingestion/") ||
      context.req.method !== "POST"
    ) {
      return next();
    }
    const operation = path.slice("/api/workflows/catalog-ingestion/".length);
    if (
      /^(resume|restart|time-travel)(?:-|$)/.test(operation) ||
      operation.endsWith("/steps/execute")
    ) {
      return context.json(
        { error: "Ingestion requires a fresh full run" },
        400,
      );
    }
    if (/^(start|stream)(?:-|$|VNext)/.test(operation)) {
      let body: Record<string, unknown>;
      try {
        body = await context.req.raw.clone().json();
      } catch {
        return context.json({ error: "Invalid ingestion request" }, 400);
      }
      if (body.perStep === true || body.initialState !== undefined) {
        return context.json(
          { error: "Ingestion requires a fresh full run" },
          400,
        );
      }
      const runId = context.req.query("runId");
      if (runId) {
        try {
          await assertFreshId(control, storage, runId);
        } catch (error) {
          return context.json(
            {
              error:
                error instanceof WorkflowHistoryError
                  ? "workflow_history_failed"
                  : "Ingestion execution already started",
            },
            error instanceof WorkflowHistoryError ? 503 : 409,
          );
        }
      }
    }
    return next();
  };
}

async function assertFreshId(
  control: ReturnType<typeof createCatalogIngestionWorkflow>["historyControl"],
  storage: MastraCompositeStore,
  runId: string,
) {
  const store = await storage.getStore("workflows");
  if (!store) {
    throw new WorkflowHistoryError(runId);
  }
  await control.assertCanStart(store, runId);
}
