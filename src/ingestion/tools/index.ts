import type { ResearchToolContext } from "./contracts";
import { createReadPageTool } from "./read-page/tool";
import { createSearchWebTool } from "./search-web/tool";

export function createResearchTools(
  sources: ResearchToolContext["sources"],
  budget: ResearchToolContext["budget"],
  modelContext: ResearchToolContext["modelContext"],
  tracing?: ResearchToolContext["tracing"],
  abortSignal?: AbortSignal,
  capture?: ResearchToolContext["capture"],
) {
  const context = {
    sources,
    budget,
    modelContext,
    tracing,
    abortSignal,
    capture,
  };
  return {
    readPage: createReadPageTool(context),
    searchWeb: createSearchWebTool(context),
  };
}
