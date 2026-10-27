import { createQueryCatalogTool } from "./query-catalog/tool";
import { createRefreshEventsTool } from "./refresh-events/tool";
import type { RefreshWorkflow } from "./refresh-events/contracts";
import type { AssistantLogging } from "../logging";

export function createAssistantTools(
  catalogPath: () => string,
  workflow: RefreshWorkflow,
  logging?: AssistantLogging,
) {
  return {
    query_catalog: createQueryCatalogTool(catalogPath, logging),
    refresh_events: createRefreshEventsTool(catalogPath, workflow, logging),
  };
}
