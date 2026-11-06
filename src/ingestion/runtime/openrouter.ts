import { randomUUID } from "node:crypto";
import type {
  AgentExecutionOptions,
  AgentInstructions,
} from "@mastra/core/agent";
import {
  StreamErrorRetryProcessor,
  type ProcessAPIErrorArgs,
} from "@mastra/core/processors";
import type { ResearchLogger } from "./logging";
import type { ResearchBudget } from "./budget";
import type { ResearchConfig } from "./config";

export const MAX_PROVIDER_UNAVAILABLE_RETRIES = 3;

/** Ordinary model calls have no web plugin. Discovery is isolated in searchWeb. */
export function createResearchModel(
  config: Pick<ResearchConfig, "apiKey" | "model">,
) {
  if (config.model.startsWith("opencode-go/")) {
    return {
      id: config.model as `opencode-go/${string}`,
      apiKey: config.apiKey,
      headers: {
        "User-Agent": "eventroam-evals/1.0",
        "x-opencode-session": randomUUID(),
      },
    };
  }
  return {
    id: `openrouter/${config.model}` as const,
    apiKey: config.apiKey,
  };
}

export function researchProviderOptions(
  config: Pick<ResearchConfig, "model" | "reasoningEffort" | "serviceTier">,
) {
  if (config.model.startsWith("opencode-go/")) {
    return {
      openai: {
        ...(config.reasoningEffort && {
          reasoningEffort: config.reasoningEffort,
        }),
      },
      openrouter: {},
    };
  }
  return {
    openai: {},
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

export function createResearchModelOptions(
  config: ResearchConfig,
  options: { instructions: string; cacheInstructions?: boolean },
) {
  const model = createResearchModel(config);
  let instructions: AgentInstructions = options.instructions;
  const providerOptions: AgentExecutionOptions["providerOptions"] =
    researchProviderOptions(config);
  if (options.cacheInstructions && model.id.startsWith("openrouter/")) {
    instructions = {
      role: "system",
      content: options.instructions,
      providerOptions: {
        openrouter: { cacheControl: { type: "ephemeral" } },
      },
    };
    // Disable automatic boundaries so dynamic input stays outside the cache.
    providerOptions.openrouter = {
      ...providerOptions.openrouter,
      prompt_cache_options: { mode: "explicit" },
    };
  }
  return { model, instructions, providerOptions };
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
      budget.assertTime();
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
