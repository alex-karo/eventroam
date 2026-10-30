import { z } from "zod";
export const pointSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const forwardInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(1260),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
});
export const geocodingRequestSchema = z.discriminatedUnion("direction", [
  forwardInputSchema.extend({ direction: z.literal("forward") }),
  pointSchema.extend({ direction: z.literal("reverse") }),
]);
export type GeocodingRequest = z.infer<typeof geocodingRequestSchema>;
export const geocodingErrorSchema = z.strictObject({
  status: z.literal("error"),
  code: z.enum([
    "unavailable",
    "timeout",
    "cancelled",
    "rate_limited",
    "network_error",
    "provider_error",
    "invalid_response",
    "limit_reached",
  ]),
});
export const candidateSchema = pointSchema.extend({
  placeId: z.string().max(1000).nullable(),
  label: z.string().max(1200),
  name: z.string().max(500).nullable(),
  countryCode: z.string().nullable(),
  locality: z.string().max(500).nullable(),
  address: z.string().max(1200).nullable(),
  objectType: z.enum(["venue", "locality", "region", "unknown"]),
  originalType: z.string().max(100).nullable(),
  category: z.string().max(200).nullable(),
  confidence: z.number().nullable(),
});
export const forwardResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("success"),
    direction: z.literal("forward"),
    candidates: z.array(candidateSchema).max(3),
  }),
  geocodingErrorSchema,
]);
export const reverseResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("success"),
    direction: z.literal("reverse"),
    queriedPoint: pointSchema,
    nearby: candidateSchema.nullable(),
    distanceKm: z.number().nonnegative().nullable(),
  }),
  geocodingErrorSchema,
]);
export const geocodingResultSchema = z.union([
  forwardResultSchema,
  reverseResultSchema,
]);
export const geocodingObservationSchema = z.strictObject({
  origin: z.enum(["initial", "agent"]),
  request: geocodingRequestSchema,
  slots: z.array(z.enum(["previousEdition", "currentOrNextEdition"])),
  cacheHit: z.boolean(),
  result: geocodingResultSchema,
  pointIds: z.array(z.string()),
});
export type GeocodingObservation = z.infer<typeof geocodingObservationSchema>;
export type GeoCandidate = z.infer<typeof candidateSchema>;
export type GeocodingResult = z.infer<typeof geocodingResultSchema>;
export type GeocodingClient = (
  request: GeocodingRequest,
  signal: AbortSignal,
) => Promise<GeocodingResult>;
export function geocodingKey(request: GeocodingRequest) {
  return request.direction === "reverse"
    ? JSON.stringify(["reverse", request.latitude, request.longitude])
    : JSON.stringify([
        "forward",
        request.query.trim().replace(/\s+/g, " "),
        request.countryCode,
      ]);
}
