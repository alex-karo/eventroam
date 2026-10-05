import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ResearchConfig } from "./config";

/** Ordinary model calls have no web plugin. Discovery is isolated in discoverSources. */
export function createResearchModel(config: ResearchConfig) {
  const openrouter = createOpenRouter({ apiKey: config.apiKey });
  return openrouter(config.model, {
    ...(config.reasoningEffort && {
      reasoning: { effort: config.reasoningEffort },
    }),
    ...(config.serviceTier && {
      extraBody: { service_tier: config.serviceTier },
    }),
  });
}
