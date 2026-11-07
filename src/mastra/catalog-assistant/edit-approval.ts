import { AsyncLocalStorage } from "node:async_hooks";
import type { Agent } from "@mastra/core/agent";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { hasAssistantExecutionState } from "./execution-context";

const threadApproval = z.object({
  toolCallId: z.string().min(1),
  threadId: z.string().min(1),
  resourceId: z.string().min(1),
  approved: z.boolean(),
  streamOptions: z.strictObject({ model: z.string().optional() }).optional(),
});
type ApprovalPair = { runId: string; toolCallId: string };

const request = new AsyncLocalStorage<
  | { kind: "preview"; proposed: boolean; inputs: Map<string, unknown> }
  | { kind: "approve"; pair: ApprovalPair; used: boolean }
>();

export function catalogEditApproval(
  agent: Pick<Agent, "getActiveThreadRunId" | "listSuspendedRuns">,
): MiddlewareHandler {
  return async (context, next) => {
    const prefix = "/api/agents/catalog-assistant/";
    if (!context.req.path.startsWith(prefix) || context.req.method !== "POST") {
      return next();
    }
    if (hasAssistantExecutionState(context.get("requestContext"))) {
      return context.json(
        { error: "Assistant execution state is managed by the server" },
        400,
      );
    }
    const action = context.req.path.slice(prefix.length);
    if (action === "send-message") {
      return request.run(
        { kind: "preview", proposed: false, inputs: new Map() },
        next,
      );
    }
    if (action !== "send-tool-approval") {
      return next();
    }
    const body: unknown = await context.req.raw
      .clone()
      .json()
      .catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      "messages" in body ||
      "resumeData" in body
    ) {
      return context.json({ error: "Use the Studio approval action" }, 400);
    }
    const approval = threadApproval.safeParse(body);
    if (!approval.success) {
      return context.json({ error: "Use the Studio approval action" }, 400);
    }
    const { threadId, resourceId, toolCallId, approved } = approval.data;
    if (!approved) {
      return next();
    }

    // Use the native thread's pending run ID to key the catalog receipts.
    let runId = agent.getActiveThreadRunId({ threadId, resourceId });
    if (!runId) {
      const { runs } = await agent.listSuspendedRuns({ threadId, resourceId });
      const matches = runs.filter(({ toolCalls }) =>
        toolCalls.some((call) => call.toolCallId === toolCallId),
      );
      if (matches.length !== 1) {
        return context.json({ error: "Open the pending draft in Studio" }, 400);
      }
      runId = matches[0].runId;
    }
    return request.run(
      { kind: "approve", pair: { runId, toolCallId }, used: false },
      next,
    );
  };
}

export function offerCatalogEdit() {
  const current = request.getStore();
  if (current?.kind !== "preview" || current.proposed) {
    return false;
  }
  current.proposed = true;
  return true;
}

export function takeCatalogEditApproval(toolCallId: string | undefined) {
  const current = request.getStore();
  if (
    current?.kind !== "approve" ||
    current.used ||
    current.pair.toolCallId !== toolCallId
  ) {
    return;
  }
  current.used = true;
  return current.pair;
}

export function rememberCatalogEditInput(toolCallId: string, input: unknown) {
  const current = request.getStore();
  if (current?.kind === "preview" && !current.proposed) {
    current.inputs.set(toolCallId, input);
  }
}

export function catalogEditInput(toolCallId: string) {
  const current = request.getStore();
  return current?.kind === "preview"
    ? current.inputs.get(toolCallId)
    : undefined;
}
