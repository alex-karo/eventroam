import type { ResearchConfig } from "./config";

/** Ordinary model calls have no web plugin. Discovery is isolated in discoverSources. */
export function createResearchModel(config: ResearchConfig) {
  return {
    id: `openrouter/${config.model}` as const,
    apiKey: config.apiKey,
  };
}

export function researchProviderOptions(config: ResearchConfig) {
  return {
    openrouter: {
      ...(config.reasoningEffort && {
        reasoning: { effort: config.reasoningEffort },
      }),
      ...(config.serviceTier && {
        service_tier: config.serviceTier,
      }),
    },
  };
}
