import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ResearchConfig } from "./config";

/** Ordinary model calls have no web plugin. Discovery is isolated in discoverSources. */
export function createResearchModel(
  config: ResearchConfig,
  onHttpResponse?: (status: number) => void,
) {
  const openrouter = createOpenRouter({
    apiKey: config.apiKey,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      onHttpResponse?.(response.status);
      return response;
    },
  });
  return openrouter(config.model, {
    ...(config.reasoningEffort && {
      reasoning: { effort: config.reasoningEffort },
    }),
    ...(config.serviceTier && {
      extraBody: { service_tier: config.serviceTier },
    }),
  });
}
