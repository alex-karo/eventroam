import { createTool } from "@mastra/core/tools";
import { searchWebInputSchema } from "../../../../ingestion/tools/search-web/contracts";
import { searchWeb } from "../../../../ingestion/tools/search-web/search";
import {
  ResearchLimitError,
  type ResearchBudget,
} from "../../../../ingestion/runtime/budget";
import { loadResearchModelConfig } from "../../../../ingestion/runtime/config";
import { trustedSearchBudget } from "../../execution-context";
import { startToolLog, type AssistantLogging } from "../../logging";

export function createSearchWebTool(logging?: AssistantLogging) {
  return createTool({
    id: "search_web",
    description:
      "Find candidate festival pages with Exa through OpenRouter. Shares a search allowance and deadline across this execution. Results are leads, not verified facts.",
    inputSchema: searchWebInputSchema,
    execute: async ({ query }, context) => {
      const call = startToolLog(logging, "search_web", context);
      let budget: ResearchBudget | undefined;
      if (context?.abortSignal?.aborted) {
        return call.finish({ ok: false, error: "cancelled" });
      }
      try {
        budget = trustedSearchBudget(context?.requestContext);
        if (!budget) {
          return call.finish({ ok: false, error: "host_context_required" });
        }
        const result = await searchWeb(query, {
          budget,
          config: loadResearchModelConfig(),
          signal: context?.abortSignal,
        });
        if (context?.abortSignal?.aborted) {
          return call.finish({ ok: false, error: "cancelled" });
        }
        return call.finish({
          ok: true,
          ...result,
          remaining: budget.remaining(),
        });
      } catch (error) {
        if (context?.abortSignal?.aborted) {
          return call.finish({ ok: false, error: "cancelled" });
        }
        return call.finish({
          ok: false,
          error:
            error instanceof ResearchLimitError
              ? `search_limit_${error.limit}`
              : "search_unavailable",
          remaining: budget?.remaining(),
        });
      }
    },
  });
}
