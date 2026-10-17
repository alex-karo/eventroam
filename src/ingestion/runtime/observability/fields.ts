import { EntityType, type CostContext } from "@mastra/core/observability";

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

export function knownEntity(id: unknown) {
  switch (id) {
    case "festival-research":
      return {
        entityId: id,
        entityType: EntityType.AGENT,
        entityName: "Festival research",
      };
    case "festival-editor":
      return {
        entityId: id,
        entityType: EntityType.AGENT,
        entityName: "Festival editor",
      };
    case "readPage":
    case "searchWeb":
      return { entityId: id, entityType: EntityType.TOOL, entityName: id };
    case "catalog-research":
      return { entityId: id, entityType: undefined, entityName: id };
    default:
      return undefined;
  }
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
  const enums: Record<string, readonly string[]> = {
    source: ["provider_reported"],
    sdkProvider: ["openrouter", "vercel_ai_gateway"],
    sdkCostField: [
      "openrouter.usage.cost",
      "openrouter.usage.costDetails.upstreamInferenceCost",
      "openrouter.usage.cost+openrouter.usage.costDetails.upstreamInferenceCost",
      "gateway.cost",
    ],
    scope: ["query_total"],
    allocation: ["query_total"],
    error: [
      "no_matching_model",
      "no_matching_tier",
      "no_pricing_for_usage_type",
      "partial_cost",
    ],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (typeof source[key] === "string" && allowed.includes(source[key])) {
      costMetadata[key] = source[key];
    }
  }
  for (const key of ["reportedStepCount", "tier_index"]) {
    const number = nonnegative(source[key]);
    if (number !== undefined) {
      costMetadata[key] = number;
    }
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
