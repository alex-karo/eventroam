import { createQueryCatalogTool } from "./query-catalog/tool";
import { createRefreshEventsTool } from "./refresh-events/tool";
import { createCancelBatchTool } from "./cancel-batch/tool";
import { createEditCatalogTool } from "./edit-catalog/tool";
import type { AssistantLogging } from "../logging";

export function createAssistantTools(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return {
    edit_catalog: createEditCatalogTool(catalogPath),
    query_catalog: createQueryCatalogTool(catalogPath, logging),
    refresh_events: createRefreshEventsTool(catalogPath, logging),
    cancel_batch: createCancelBatchTool(catalogPath, logging),
  };
}
