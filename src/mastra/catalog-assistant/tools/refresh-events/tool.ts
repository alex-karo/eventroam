import { createTool } from "@mastra/core/tools";
import {
  JobStorageError,
  openJobCatalog,
  submitJobs,
  refreshInputSchema,
} from "../../../../ingestion/jobs/store";
import {
  refreshConsumedKey,
  trustedConversation,
} from "../../execution-context";
import { startToolLog, type AssistantLogging } from "../../logging";

export function createRefreshEventsTool(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return createTool({
    id: "refresh_events",
    description:
      "Submit one to 200 distinct existing Events for background refresh. dryRun defaults to preview; false applies. One selection per execution. Returns batch ID and accepted count. Read progress and reports through query_catalog.",
    inputSchema: refreshInputSchema,
    execute: async (input, context) => {
      const call = startToolLog(logging, "refresh_events", context, {
        eventIds: input.eventIds,
        scope: input.scope,
        dryRun: input.dryRun,
      });
      const requestContext = context?.requestContext;
      if (!trustedConversation(requestContext)) {
        return call.finish({ ok: false, error: "host_context_required" });
      }
      if (context?.abortSignal?.aborted) {
        return call.finish({ ok: false, error: "cancelled" });
      }
      let client;
      try {
        client = openJobCatalog(catalogPath());
        const accepted = submitJobs(client, input, () => {
          if (requestContext.get(refreshConsumedKey) !== false) {
            throw new JobStorageError("selection_consumed");
          }
          requestContext.set(refreshConsumedKey, true);
        });
        return call.finish({ ok: true, ...accepted }, accepted);
      } catch (error) {
        return call.finish({
          ok: false,
          error:
            error instanceof JobStorageError
              ? error.code
              : "job_storage_unavailable",
        });
      } finally {
        client?.close();
      }
    },
  });
}
