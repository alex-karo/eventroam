import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  cancelPendingJobs,
  JobStorageError,
  openJobCatalog,
} from "../../../../ingestion/jobs/store";
import { trustedConversation } from "../../execution-context";
import { startToolLog, type AssistantLogging } from "../../logging";

export function createCancelRefreshTool(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return createTool({
    id: "cancel_refresh",
    description:
      "Cancel pending jobs in a resolved batch after an explicit owner request. Running and terminal jobs stay unchanged.",
    inputSchema: z.strictObject({ batchId: z.uuid() }),
    execute: async ({ batchId }, context) => {
      const call = startToolLog(logging, "cancel_refresh", context, {
        batchId,
      });
      if (!trustedConversation(context?.requestContext)) {
        return call.finish({ ok: false, error: "host_context_required" });
      }
      if (context?.abortSignal?.aborted) {
        return call.finish({ ok: false, error: "cancelled" });
      }
      let client;
      try {
        client = openJobCatalog(catalogPath());
        const result = cancelPendingJobs(client, batchId);
        return call.finish(
          { ok: true, ...result },
          { batchId, cancelledCount: result.cancelledCount },
        );
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
