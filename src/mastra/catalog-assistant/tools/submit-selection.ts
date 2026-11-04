import type Database from "better-sqlite3";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { JobStorageError, openJobCatalog } from "../../../ingestion/jobs/store";
import {
  submissionConsumedKey,
  trustedConversation,
} from "../execution-context";
import { startToolLog, type AssistantLogging } from "../logging";

/** Submission consumes the host guard inside the storage transaction. */
export function submitSelection(
  catalogPath: () => string,
  logging: AssistantLogging,
  toolName: string,
  context: ToolExecutionContext | undefined,
  fields: Record<string, unknown>,
  submit: (
    client: Database.Database,
    consume: () => void,
  ) => { batchId: string; acceptedCount: number },
) {
  const call = startToolLog(logging, toolName, context, fields);
  const requestContext = context?.requestContext;
  if (!requestContext || !trustedConversation(requestContext)) {
    return call.finish({ ok: false, error: "host_context_required" });
  }
  if (context?.abortSignal?.aborted) {
    return call.finish({ ok: false, error: "cancelled" });
  }
  let client;
  try {
    client = openJobCatalog(catalogPath());
    const accepted = submit(client, () => {
      if (requestContext.get(submissionConsumedKey) !== false) {
        throw new JobStorageError("selection_consumed");
      }
      requestContext.set(submissionConsumedKey, true);
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
}
