import {
  StreamErrorRetryProcessor,
  type ProcessAPIErrorArgs,
} from "@mastra/core/processors";
import type { ResearchLogger } from "./logging";
import type { ResearchBudget } from "./budget";
import type { ResearchConfig } from "./config";

export const MAX_PROVIDER_UNAVAILABLE_RETRIES = 3;

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

/** Retry only OpenRouter's explicit capacity failure, never a generic 502. */
export function providerUnavailableRetry(
  budget: ResearchBudget,
  onUnavailable: () => void,
  log?: ResearchLogger,
) {
  const retry = new StreamErrorRetryProcessor({
    maxRetries: MAX_PROVIDER_UNAVAILABLE_RETRIES,
    delayMs: ({ retryCount }) => 10_000 * 3 ** retryCount,
    matchers: [isProviderUnavailable],
  });
  const retryLog = log?.child({ stage: "research" });
  let retries = 0;
  return {
    id: "openrouter-provider-unavailable",
    async processAPIError(args: ProcessAPIErrorArgs) {
      if (!isProviderUnavailable(args.error)) {
        return;
      }
      budget.refundModelCall();
      onUnavailable();
      // Mastra resets retryCount after a successful step; cap the entire run.
      if (retries >= MAX_PROVIDER_UNAVAILABLE_RETRIES) {
        return;
      }
      retryLog?.warn("Provider retry scheduled", {
        providerCode: "provider_unavailable",
        retryAttempt: retries + 1,
        delayMs: 10_000 * 3 ** retries,
        remaining: budget.remaining(),
      });
      return retry.processAPIError({ ...args, retryCount: retries++ });
    },
  };
}

function isProviderUnavailable(error: unknown): boolean {
  type ProviderError = { metadata?: { error_type?: unknown } };
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth += 1
  ) {
    const item = current as {
      data?: ProviderError & { error?: ProviderError };
      cause?: unknown;
    };
    const data = item.data?.error ?? item.data;
    if (data?.metadata?.error_type === "provider_unavailable") {
      return true;
    }
    current = item.cause;
  }
  return false;
}
