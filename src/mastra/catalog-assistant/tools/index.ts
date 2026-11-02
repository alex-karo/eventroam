import { createQueryCatalogTool } from "./query-catalog/tool";
import { createRefreshEventsTool } from "./refresh-events/tool";
import { createCancelRefreshTool } from "./cancel-refresh/tool";
import type { AssistantLogging } from "../logging";

export function createAssistantTools(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return {
    query_catalog: createQueryCatalogTool(catalogPath, logging),
    refresh_events: createRefreshEventsTool(catalogPath, logging),
    cancel_refresh: createCancelRefreshTool(catalogPath, logging),
  };
}
