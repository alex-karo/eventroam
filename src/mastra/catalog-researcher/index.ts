import type { MastraModelConfig } from "@mastra/core/llm";
import type { Memory } from "@mastra/memory";
import { readDatabaseEnvironment } from "../../db/env";
import { createCatalogChatAgent } from "../catalog-assistant";
import type { AssistantLogging } from "../catalog-assistant/logging";
import { createQueryCatalogTool } from "../catalog-assistant/tools/query-catalog/tool";
import { createAddEventsTool } from "./tools/add-events";
import { createSearchWebTool } from "./tools/search-web";
import { RESEARCHER_INSTRUCTIONS } from "./prompt";

export function createCatalogResearcher(
  memory: Memory,
  model?: MastraModelConfig,
  logging?: AssistantLogging,
) {
  const catalogPath = () => readDatabaseEnvironment().DATABASE_PATH;
  return createCatalogChatAgent(
    memory,
    {
      id: "catalog-researcher",
      name: "Catalog researcher",
      instructions: RESEARCHER_INSTRUCTIONS,
      tools: {
        search_web: createSearchWebTool(logging),
        add_events: createAddEventsTool(catalogPath, logging),
        query_catalog: createQueryCatalogTool(catalogPath, logging),
      },
    },
    model,
  );
}
