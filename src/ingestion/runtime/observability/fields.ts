import type { CostContext } from "@mastra/core/observability";

export function nonnegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** Technical identifiers, never arbitrary provider envelopes or display text. */
export function technicalId(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 160 &&
    /^[a-zA-Z0-9][a-zA-Z0-9_./:@+-]*$/.test(value)
    ? value
    : undefined;
}

/** Preserve the installed SDK's accounting basis without copying provider data. */
export function safeCostContext(
  value: CostContext | undefined,
): CostContext | undefined {
  if (!value) {
    return undefined;
  }
  const source = value.costMetadata ?? {};
  const costMetadata: Record<string, unknown> = {};
  if (source.source === "provider_reported") {
    costMetadata.source = "provider_reported";
  }
  const pricingId = technicalId(source.pricing_id);
  if (pricingId) {
    costMetadata.pricing_id = pricingId;
  }
  return {
    provider: technicalId(value.provider),
    model: technicalId(value.model),
    estimatedCost: nonnegative(value.estimatedCost),
    costUnit: value.costUnit === "USD" ? "USD" : undefined,
    costMetadata,
  };
}
