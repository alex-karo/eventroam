import { z } from "zod";
import { price, priceDetails } from "@/catalog/domain/price";
import {
  dateStates,
  scheduleStatuses,
  coordinatePrecisions,
  linkKinds,
} from "@/catalog/domain/vocabulary";
import {
  latitude,
  longitude,
  sizeEstimate,
  editionScalarSchemas,
} from "@/catalog/domain/edition-values";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const url = z.url().refine((value) => /^https?:\/\//.test(value));
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
const eventData = z
  .object({
    slug,
    canonicalName: z.string().trim().min(1).max(250),
    aliases: z.array(z.string().trim().min(1).max(250)).max(30).optional(),
    description: z.string().max(2000).nullable().optional(),
    shortDescription: z.string().max(2000).nullable().optional(),
  })
  .strict();
const editionData = z
  .object({
    editionKey: slug,
    displayName: z.string().trim().min(1).max(250).nullable().optional(),
    editionYear: editionScalarSchemas.editionYear,
    startsOn: editionScalarSchemas.startsOn,
    endsOn: editionScalarSchemas.endsOn,
    dateState: z.enum(dateStates).optional(),
    scheduleStatus: z.enum(scheduleStatuses).optional(),
    sizeEstimate,
    venueName: z.string().trim().min(1).max(250).nullable().optional(),
    venueAddress: z.string().trim().min(1).max(500).nullable().optional(),
    locality: z.string().trim().min(1).max(250).nullable().optional(),
    administrativeArea: z.string().trim().min(1).max(250).nullable().optional(),
    countryCode: editionScalarSchemas.countryCode,
    latitude,
    longitude,
    coordinatePrecision: z.enum(coordinatePrecisions).optional(),
    timeZone: editionScalarSchemas.timeZone,
    price: price.nullable().optional(),
  })
  .strict();
export const catalogPriceBlockSchema = z
  .object({
    priceDetails,
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
    kind: z.literal("createEdition"),
    eventId: z.string().min(1),
    data: editionData.required({ editionKey: true }),
  }),
  common.extend({
    kind: z.literal("updateEdition"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    data: editionData.omit({ editionKey: true, price: true }).partial(),
  }),
  common.extend({
    kind: z.literal("publishEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("publishEdition"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawEdition"),
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
      z.object({ type: z.literal("edition"), id: z.string().min(1) }),
    ]),
    expectedVersion: z.number().int().positive(),
    links: z
      .array(
        z
          .object({
            kind: z.enum(linkKinds),
            url,
            label: z.string().max(250).nullable().optional(),
            official: z.boolean(),
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
export type CatalogPriceDetail = z.infer<typeof priceDetails>[number];
export type CatalogOperationResult = {
  id: string;
  version: number;
  changed: boolean;
};
