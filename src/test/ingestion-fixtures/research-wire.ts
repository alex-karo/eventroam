import { z } from "zod";
import {
  researchCandidateSchema,
  editionSlotNames,
} from "@/ingestion/research/contracts";

import { modelOutputSchema as outputSchema } from "@/ingestion/runtime/model-output";

export const modelOutputSchema = (
  output: z.ZodType = researchCandidateSchema,
) => outputSchema(output);

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
