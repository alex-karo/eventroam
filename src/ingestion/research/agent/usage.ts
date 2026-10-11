export type ModelUsage = {
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  modelCostUsd: number | null;
};

type UsageStep = {
  usage?: { inputTokens?: number; outputTokens?: number; raw?: unknown };
};

/** Sum reported costs, leaving the result unknown only when none are available. */
export function sumKnownModelCosts(costs: (number | null)[]): number | null {
  return costs.reduce<number | null>(
    (sum, cost) => (cost === null ? sum : (sum ?? 0) + cost),
    null,
  );
}

/** Share the selected provider metrics between step logs and run accounting. */
export function completedStepUsage(step: UsageStep): ModelUsage {
  const input = step.usage?.inputTokens;
  const output = step.usage?.outputTokens;
  // OpenRouter synthesizes zero counts when usage is missing. Inspect the
  // original usage only to determine completeness, never export it.
  let raw = step.usage?.raw;
  while (raw && typeof raw === "object" && "raw" in raw) {
    raw = raw.raw;
  }
  const rawUsage = raw as
    { prompt_tokens?: number; completion_tokens?: number } | undefined;
  const providerUsage = (
    step as {
      providerMetadata?: {
        openrouter?: {
          usage?: {
            cost?: number;
            promptTokensDetails?: { cachedTokens?: number };
            completionTokensDetails?: { reasoningTokens?: number };
          };
        };
      };
    }
  ).providerMetadata?.openrouter?.usage;
  const observed = input !== undefined || output !== undefined;
  const cost = providerUsage?.cost;
  return {
    complete:
      rawUsage?.prompt_tokens != null &&
      rawUsage?.completion_tokens != null &&
      input !== undefined &&
      output !== undefined,
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    cachedInputTokens: observed
      ? (providerUsage?.promptTokensDetails?.cachedTokens ?? null)
      : null,
    reasoningTokens: observed
      ? (providerUsage?.completionTokensDetails?.reasoningTokens ?? null)
      : null,
    modelCostUsd:
      cost !== undefined && Number.isFinite(cost) && cost >= 0 ? cost : null,
  };
}

export function updateModelUsage(usage: ModelUsage, step: UsageStep): void {
  const selected = completedStepUsage(step);
  usage.complete &&= selected.complete;
  usage.modelCostUsd = sumKnownModelCosts([
    usage.modelCostUsd,
    selected.modelCostUsd,
  ]);
  if (
    step.usage?.inputTokens === undefined &&
    step.usage?.outputTokens === undefined
  ) {
    return;
  }
  usage.inputTokens += selected.inputTokens;
  usage.outputTokens += selected.outputTokens;
  usage.cachedInputTokens =
    usage.cachedInputTokens !== null && selected.cachedInputTokens !== null
      ? usage.cachedInputTokens + selected.cachedInputTokens
      : null;
  usage.reasoningTokens =
    usage.reasoningTokens !== null && selected.reasoningTokens !== null
      ? usage.reasoningTokens + selected.reasoningTokens
      : null;
}
