import { scheduleStatuses, linkKinds } from "@/catalog/domain/vocabulary";
import { z } from "zod";
import { catalogPriceBlockSchema } from "@/catalog/operations/operation";

const editionKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(63);

export const researchClaimSchema = z
  .union([
    z
      .object({
        editionKey,
        field: z.literal("scheduleStatus"),
        value: z.enum(scheduleStatuses),
      })
      .strict(),
    z
      .object({
        editionKey,
        field: z.enum([
          "startsOn",
          "endsOn",
          "dateState",
          "displayName",
          "venueName",
          "venueAddress",
          "locality",
          "administrativeArea",
          "countryCode",
          "latitude",
          "longitude",
          "coordinatePrecision",
          "timeZone",
          "capacityEstimate",
          "ticketAvailability",
          "termIds",
          "removeTermIds",
        ]),
        value: z.union([z.string(), z.number(), z.null(), z.array(z.string())]),
      })
      .strict(),
  ])
  .refine(
    (claim) =>
      (claim.field === "termIds" || claim.field === "removeTermIds") ===
      Array.isArray(claim.value),
    { message: "Term claims require an array; other claims require one value" },
  );

export const researchCandidateSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    eventName: z.string().trim().min(1).max(250),
    summary: z.string().max(2000).optional(),
    editions: z
      .array(
        z
          .object({
            key: editionKey,
            year: z.number().int().min(1).max(9999).optional(),
            status: z.enum(["completed", "announced", "cancelled"]),
          })
          .strict(),
      )
      .max(20),
    claims: z.array(researchClaimSchema).max(300),
    prices: z
      .array(catalogPriceBlockSchema.extend({ editionKey }).strict())
      .max(20),
    links: z
      .array(
        z
          .object({
            owner: z.enum(["event", "occurrence"]),
            editionKey: editionKey.optional(),
            kind: z.enum(linkKinds),
            url: z.url(),
            label: z.string().max(250).optional(),
          })
          .strict(),
      )
      .max(60),
    observations: z
      .array(z.object({ detail: z.string().min(1).max(500) }).strict())
      .max(20),
  })
  .strict();

export type ResearchCandidate = z.infer<typeof researchCandidateSchema>;
export type ResearchClaim = z.infer<typeof researchClaimSchema>;
export type ResearchGap = {
  code:
    | "invalid_candidate"
    | "ambiguous_identity"
    | "limit_reached"
    | "model_failed"
    | "write_failed"
    | "observation";
  field?: string;
  editionKey?: string;
  detail?: string;
  diagnostic?: string;
};
export const RESEARCH_PROMPT_VERSION = "model-direct-v3";
