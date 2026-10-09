import { z } from "zod";
import { mainDraftSchema } from "./contracts";
// OpenRouter's strict response_format accepts shape rather than Zod's optional
// properties or validation keywords. Strict Zod validation still runs locally.
export function modelOutputSchema(schemaType: z.ZodType = mainDraftSchema) {
  const stripped = new Set([
    "$schema",
    "format",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minItems",
    "maxItems",
  ]);
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(clean);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const original = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(original)
        .filter(([key]) => !stripped.has(key))
        .map(([key, part]) => [key === "oneOf" ? "anyOf" : key, clean(part)]),
    );
    if (
      result.type === "object" &&
      result.properties &&
      typeof result.properties === "object"
    ) {
      const properties = result.properties as Record<string, unknown>;
      const required = new Set(
        Array.isArray(original.required) ? original.required : [],
      );
      for (const [key, property] of Object.entries(properties)) {
        if (!required.has(key)) {
          properties[key] = { anyOf: [property, { type: "null" }] };
        }
      }
      result.required = Object.keys(properties);
      result.additionalProperties = false;
    }
    return result;
  };
  const schema = z.toJSONSchema(schemaType);
  return clean(schema) as typeof schema;
}

const optionalNullPaths = new Set([
  "data.eventId",
  "data.reason",
  "data.summary",
  "data.links.website",
  ...["instagram", "facebook", "youtube", "tiktok", "x", "other"].map(
    (field) => `data.links.socials.${field}`,
  ),
  ...[
    "year",
    "dates",
    "scheduleStatus",
    "displayName",
    "venueName",
    "venueAddress",
    "locality",
    "administrativeArea",
    "countryCode",
    "coordinates",
    "capacityEstimate",
    "classification",
    "tickets",
  ].map((field) => `data.editions.*.${field}`),
  "data.editions.*.classification.add",
  "data.editions.*.classification.remove",
  "data.editions.*.links.tickets",
  ...["amount", "currency", "terms", "availability", "url"].map(
    (field) => `data.editions.*.tickets.value.variants.*.${field}`,
  ),
  "data.editions.*.tickets.value.basePrice.qualification",
  ...["url", "editionKey", "field"].map((field) => `errors.*.${field}`),
  ...["editionKey", "field"].map((field) => `unresolved.*.${field}`),
]);

export function normalizeWireCandidate(
  value: unknown,
  path: string[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWireCandidate(item, [...path, "*"]));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, part]) =>
          part !== null || !optionalNullPaths.has([...path, key].join(".")),
      )
      .map(([key, part]) => [
        key,
        normalizeWireCandidate(part, [...path, key]),
      ]),
  );
}

const ticketOptionalNullPaths = new Set([
  "editions.*.tickets",
  ...["amount", "currency", "terms", "availability", "url"].map(
    (field) => `editions.*.tickets.value.variants.*.${field}`,
  ),
  "editions.*.tickets.value.basePrice.qualification",
  "editions.*.unresolved.*.editionKey",
  "editions.*.unresolved.*.field",
]);

export function normalizeWireTickets(value: unknown): unknown {
  return normalizeOptionalNulls(value, ticketOptionalNullPaths);
}
function normalizeOptionalNulls(
  value: unknown,
  optional: Set<string>,
  path: string[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeOptionalNulls(item, optional, [...path, "*"]),
    );
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, part]) =>
          part !== null || !optional.has([...path, key].join(".")),
      )
      .map(([key, part]) => [
        key,
        normalizeOptionalNulls(part, optional, [...path, key]),
      ]),
  );
}

export function normalizeWireMain(value: unknown): unknown {
  const optional = new Set(
    [...optionalNullPaths].filter(
      (path) => !path.startsWith("data.editions.*.tickets"),
    ),
  );
  return normalizeOptionalNulls(value, optional);
}
