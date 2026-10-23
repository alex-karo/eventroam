import { z } from "zod";
import { researchCandidateSchema, editionSlotNames } from "../contracts";

// OpenRouter's strict response_format accepts shape rather than Zod's optional
// properties or validation keywords. Strict Zod validation still runs locally.
export function modelOutputSchema(output: z.ZodType = researchCandidateSchema) {
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
  const schema = z.toJSONSchema(output);
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
  ...editionSlotNames.flatMap((slot) => [
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
      "sizeEstimate",
      "classification",
      "tickets",
    ].map((field) => `data.${slot}.${field}`),
    `data.${slot}.links.tickets`,
    ...["amount", "currency", "terms", "availability", "url"].map(
      (field) => `data.${slot}.tickets.value.variants.*.${field}`,
    ),
    `data.${slot}.tickets.value.basePrice.qualification`,
  ]),
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
