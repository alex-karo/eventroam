import type { ResearchToolContext } from "./contracts";
import { createReadPageTool } from "./read-page/tool";
import { createSearchWebTool } from "./search-web/tool";

export function createResearchTools(
  sources: ResearchToolContext["sources"],
  budget: ResearchToolContext["budget"],
  modelContext: ResearchToolContext["modelContext"],
  tracing?: ResearchToolContext["tracing"],
  abortSignal?: AbortSignal,
) {
  const context = {
    sources,
    budget,
    modelContext,
    tracing,
    abortSignal,
  };
  return {
    readPage: createReadPageTool(context),
    searchWeb: createSearchWebTool(context),
  };
}
