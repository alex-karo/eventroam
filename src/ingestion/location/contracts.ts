import { z } from "zod";
import { modelOutputSchema } from "../research/agent/wire";
import { pointSchema } from "../tools/geocode/contracts";

export const LOCATION_PROMPT_VERSION = "catalog-location-v6";
export const locationTextFields = [
  "venueName",
  "venueAddress",
  "locality",
  "administrativeArea",
  "countryCode",
] as const;
export const precisionSchema = z.enum([
  "exact",
  "approximate",
  "locality",
  "region",
]);
export type Precision = z.infer<typeof precisionSchema>;
const reason = z.string().trim().min(1).max(2000);
function textAction(value: z.ZodString) {
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("set"), value, reason }),
    z.strictObject({ action: z.literal("keep"), reason }),
    z.strictObject({ action: z.literal("clear"), reason }),
  ]);
}
export const locationFieldsSchema = z.strictObject({
  venueName: textAction(z.string().trim().min(1).max(250)),
  venueAddress: textAction(z.string().trim().min(1).max(500)),
  locality: textAction(z.string().trim().min(1).max(250)),
  administrativeArea: textAction(z.string().trim().min(1).max(250)),
  countryCode: textAction(z.string().regex(/^[A-Z]{2}$/)),
});
export const coordinateDecisionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("keep"), reason }),
  z.strictObject({ action: z.literal("clear"), reason }),
  z.strictObject({
    action: z.literal("inherit"),
    donorPointId: z.string().min(1),
    reason,
  }),
  z.strictObject({
    action: z.literal("select"),
    pointId: z.string().min(1),
    precision: precisionSchema,
    reason,
  }),
]);
export const locationSlotSchema = z.strictObject({
  fields: locationFieldsSchema,
  coordinates: coordinateDecisionSchema,
  unresolved: z
    .array(
      z.strictObject({ message: reason, field: z.string().min(1).nullable() }),
    )
    .max(30),
});
export const locationOutputSchema = z.strictObject({
  decision: z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("ready"),
      previousEdition: locationSlotSchema.nullable(),
      currentOrNextEdition: locationSlotSchema.nullable(),
    }),
    z.strictObject({ status: z.literal("rejected"), reason }),
  ]),
});
export const locationModelOutputSchema = () =>
  modelOutputSchema(locationOutputSchema);
export type LocationOutput = z.infer<typeof locationOutputSchema>;
export type LocationSlot = z.infer<typeof locationSlotSchema>;
export type LocationFields = z.infer<typeof locationFieldsSchema>;
export type Point = z.infer<typeof pointSchema>;
export const registeredPointSchema = pointSchema.extend({
  id: z.string(),
  kind: z.enum(["target", "donor", "source", "candidate"]),
  precision: precisionSchema,
  editionKey: z.string().optional(),
  editionId: z.string().optional(),
  version: z.number().int().positive().optional(),
  countryCode: z.string().optional(),
  provider: z.literal("geoapify").optional(),
  placeId: z.string().optional(),
  label: z.string().optional(),
  objectType: z.enum(["venue", "locality", "region", "unknown"]).optional(),
  comparisons: z
    .array(
      z.strictObject({
        slot: z.enum(["previousEdition", "currentOrNextEdition"]),
        targetKm: z.number().nonnegative().nullable(),
        donorKm: z.number().nonnegative().nullable(),
      }),
    )
    .optional(),
});
export type RegisteredPoint = z.infer<typeof registeredPointSchema>;
