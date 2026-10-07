import { z } from "zod";
import { isAssignedCountryCode } from "@/catalog/domain/country-codes";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const localDate = z.iso.date();
const url = z.url().refine((value) => /^https?:\/\//.test(value));
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(
    (value) => Intl.supportedValuesOf("currency").includes(value),
    "Unknown ISO currency",
  );
const common = z
  .object({
    operationKey: z.string().min(1).max(200),
    actor: z.string().min(1).max(200),
    initiatedBy: z.string().min(1).max(200).optional(),
    note: z.string().max(500).optional(),
    tempKey: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)
      .optional(),
  })
  .strict();
const price = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("free"),
      minMinor: z.literal(0),
      maxMinor: z.literal(0),
      coverage: z.literal("full_programme"),
      qualification: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["exact", "from", "range"]),
      currency,
      minMinor: z.number().int().nonnegative(),
      maxMinor: z.number().int().nonnegative(),
      coverage: z.enum(["full_programme", "day", "package"]),
      qualification: z.string().max(500).optional(),
    })
    .strict()
    .refine((p) =>
      p.kind === "range" ? p.maxMinor > p.minMinor : p.maxMinor === p.minMinor,
    ),
]);
const priceDetail = z
  .object({
    label: z.string().trim().min(1).max(250),
    amount: z.number().nonnegative().optional(),
    currency: currency.optional(),
    terms: z.string().trim().min(1).max(1000).optional(),
    availability: z
      .enum(["unknown", "available", "sold_out", "closed"])
      .optional(),
    url: url.optional(),
  })
  .strict()
  .refine(
    (value) => (value.amount === undefined) === (value.currency === undefined),
    {
      message: "Amount and currency must be supplied together",
    },
  );
const eventData = z
  .object({
    slug,
    canonicalName: z.string().trim().min(1).max(250),
    aliases: z.array(z.string().trim().min(1).max(250)).max(30).optional(),
    summary: z.string().max(2000).nullable().optional(),
  })
  .strict();
const occurrenceData = z
  .object({
    occurrenceKey: slug,
    displayName: z.string().trim().min(1).max(250).nullable().optional(),
    occurrenceYear: z.number().int().min(1).max(9999).nullable().optional(),
    startsOn: localDate.nullable().optional(),
    endsOn: localDate.nullable().optional(),
    dateState: z.enum(["unknown", "provisional", "confirmed"]).optional(),
    scheduleStatus: z
      .enum(["announced", "scheduled", "postponed", "cancelled"])
      .optional(),
    ticketAvailability: z
      .enum(["unknown", "available", "sold_out", "closed"])
      .optional(),
    capacityEstimate: z.number().int().positive().nullable().optional(),
    venueName: z.string().trim().min(1).max(250).nullable().optional(),
    venueAddress: z.string().trim().min(1).max(500).nullable().optional(),
    locality: z.string().trim().min(1).max(250).nullable().optional(),
    administrativeArea: z.string().trim().min(1).max(250).nullable().optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .refine(
        isAssignedCountryCode,
        "Country code is not assigned by ISO 3166-1",
      )
      .nullable()
      .optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    coordinatePrecision: z
      .enum(["unknown", "exact", "approximate", "locality", "region"])
      .optional(),
    timeZone: z.string().max(100).nullable().optional(),
    price: price.nullable().optional(),
  })
  .strict();
export const catalogPriceBlockSchema = z
  .object({
    priceDetails: z.array(priceDetail).max(100),
    basePrice: price
      .nullable()
      .refine(
        (value) => value === null || value.coverage === "full_programme",
        {
          message: "Primary price must cover the full programme",
        },
      ),
  })
  .strict();
export const catalogOperationSchema = z.discriminatedUnion("kind", [
  common.extend({ kind: z.literal("createEvent"), data: eventData }),
  common.extend({
    kind: z.literal("updateEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    data: eventData.partial(),
  }),
  common.extend({
    kind: z.literal("createOccurrence"),
    eventId: z.string().min(1),
    data: occurrenceData.required({ occurrenceKey: true }),
  }),
  common.extend({
    kind: z.literal("updateOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    data: occurrenceData.omit({ occurrenceKey: true }).partial(),
  }),
  common.extend({
    kind: z.literal("publishEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("publishOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("replaceTerms"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    termIds: z.array(z.string().min(1)).max(50),
  }),
  common.extend({
    kind: z.literal("replaceLinks"),
    owner: z.discriminatedUnion("type", [
      z.object({ type: z.literal("event"), id: z.string().min(1) }),
      z.object({ type: z.literal("occurrence"), id: z.string().min(1) }),
    ]),
    expectedVersion: z.number().int().positive(),
    links: z
      .array(
        z
          .object({
            kind: z.enum([
              "official_site",
              "instagram",
              "facebook",
              "youtube",
              "tiktok",
              "ticketing",
              "other",
            ]),
            url,
            label: z.string().max(250).nullable().optional(),
            official: z.boolean(),
            sourceId: z.string().nullable().optional(),
          })
          .strict(),
      )
      .max(30),
  }),
  common.extend({
    kind: z.literal("replacePriceBlock"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    ...catalogPriceBlockSchema.shape,
  }),
]);
export type CatalogOperation = z.input<typeof catalogOperationSchema>;
export type CatalogOperationMeta = z.infer<typeof common>;
export type CatalogPrice = z.infer<typeof price>;
export type CatalogPriceDetail = z.infer<typeof priceDetail>;
export type CatalogOperationResult = {
  id: string;
  version: number;
  changed: boolean;
};
