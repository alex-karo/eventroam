import type { ResearchToolContext } from "./contracts";
import { createReadSourceTool } from "./read-source/tool";
import { createDiscoverSourcesTool } from "./discover-sources/tool";

export function createResearchTools(
  sources: ResearchToolContext["sources"],
  budget: ResearchToolContext["budget"],
  modelContext: ResearchToolContext["modelContext"],
  tracing?: ResearchToolContext["tracing"],
  abortSignal?: AbortSignal,
) {
  const context = { sources, budget, modelContext, tracing, abortSignal };
  return {
    readSource: createReadSourceTool(context),
    discoverSources: createDiscoverSourcesTool(context),
  };
}
