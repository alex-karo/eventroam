import { z } from "zod";
import { editionScalarSchemas } from "@/catalog/domain/edition-values";
import { scheduleStatuses } from "@/catalog/domain/vocabulary";
import type { topics } from "../evidence/contracts";
import {
  editionKeySchema,
  dateBlockSchema,
  researchBasePriceSchema,
  researchQuestionSchema,
  ticketOfferSchema,
} from "../research/contracts";

export const roleEvidenceTopics = {
  general: ["identity", "description", "dates", "status", "size", "location"],
  tickets: ["tickets", "dates", "identity", "location"],
  classification: ["classification", "description", "dates"],
  links: ["links", "tickets", "identity"],
} as const satisfies Record<string, readonly (typeof topics)[number][]>;

export const reasonSchema = z
  .string()
  .trim()
  .min(1)
  .describe(
    "Explain the decision in 1-3 short sentences, normally under 2000 characters.",
  );
export const supportSchema = z.array(z.string().min(1)).max(100);
const common = { reason: reasonSchema, evidenceIds: supportSchema };
const setChange = <T extends z.ZodType>(value: T) =>
  z.strictObject({ action: z.literal("set"), value, ...common });
const clearChange = z.strictObject({ action: z.literal("clear"), ...common });
export function change<T extends z.ZodType>(
  value: T,
  clearable: false,
): ReturnType<typeof setChange<T>>;
export function change<T extends z.ZodType>(
  value: T,
  clearable?: true,
): z.ZodUnion<[ReturnType<typeof setChange<T>>, typeof clearChange]>;
export function change<T extends z.ZodType>(value: T, clearable = true) {
  const set = setChange(value);
  return clearable ? z.union([set, clearChange]) : set;
}
export const generalFieldsSchema = z.strictObject({
  year: change(z.number().int().min(1).max(9999), false).optional(),
  dates: change(dateBlockSchema).optional(),
  scheduleStatus: change(z.enum(scheduleStatuses), false).optional(),
  displayName: change(z.string().min(1).max(250)).optional(),
  sizeEstimate: change(z.number().int().positive())
    .optional()
    .describe(
      "Assess each selected Edition independently. A cited past participant count with an explicit similar-scale expectation for this Edition can support an estimate even when no current attendance total is published. This does not establish a measured total.",
    ),
});
const check = z.strictObject({
  check: z.string().min(1).max(100),
  finding: z.enum(["verified", "unfinished"]),
  explanation: reasonSchema,
  evidenceIds: supportSchema,
  sourceIds: z.array(z.string()).max(100),
});
export const checksSchema = z.array(check).max(40);
export type CheckFinding = z.infer<typeof check>;
export const questionsSchema = z.array(researchQuestionSchema).max(30);
const collectionNote = z
  .string()
  .trim()
  .min(1)
  .describe("Use one short sentence, normally at most 300 characters.");
const collectionCheck = {
  check: check.shape.check,
  sourceIds: check.shape.sourceIds,
};
export const collectionOutputSchema = z.strictObject({
  checks: z
    .array(
      z.strictObject({
        ...collectionCheck,
        blocker: collectionNote.nullable(),
      }),
    )
    .max(40),
  unresolved: z.array(z.strictObject({ message: collectionNote })).max(30),
});
export const targetSchema = z.strictObject({
  editionKey: editionKeySchema,
  reason: reasonSchema,
  evidenceIds: supportSchema
    .min(1)
    .describe(
      "Cite inspected source evidence for this target's temporal role, including saved Editions. If unsupported, return a null target instead.",
    ),
  fields: generalFieldsSchema,
});
const identity = {
  eventId: z.string().min(1).nullable(),
  observedEventName: z.string().trim().min(1).max(250),
  reason: reasonSchema,
  evidenceIds: supportSchema,
};
export const festivalCountriesSchema = z
  .array(
    z.strictObject({
      countryCode: editionScalarSchemas.countryCode.unwrap().unwrap(),
      evidenceIds: supportSchema.min(1),
    }),
  )
  .max(20)
  .optional()
  .describe(
    "In refresh, list each sourced country where the target festival takes place, even without selected Edition slots. Cite inspected evidence. Use an empty list when the country is unknown or the source cannot be tied to the target festival.",
  );
export const generalOutputSchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("duplicate"),
    ...identity,
    eventId: z.string().min(1),
  }),
  z.strictObject({
    decision: z.literal("uncertain"),
    reason: reasonSchema,
    unresolved: questionsSchema,
    festivalCountries: festivalCountriesSchema,
  }),
  z.strictObject({
    decision: z.literal("targets"),
    ...identity,
    festivalCountries: festivalCountriesSchema,
    previousEdition: targetSchema
      .nullable()
      .describe(
        "Latest actually completed Edition, or null when completion is not established. Never return an unsupported saved candidate with empty evidence. Explain that uncertainty in checks and unresolved.",
      ),
    currentOrNextEdition: targetSchema
      .nullable()
      .describe(
        "Ongoing or nearest announced future Edition with source support, or null if no such target is established.",
      ),
    checks: checksSchema,
    unresolved: questionsSchema,
  }),
]);
export const refreshGeneralOutputSchema = z.discriminatedUnion("decision", [
  generalOutputSchema.options[1],
  generalOutputSchema.options[2],
]);
export type GeneralOutput = z.infer<typeof generalOutputSchema>;
export type Targets = Extract<GeneralOutput, { decision: "targets" }>;

export const ticketBlockSchema = z
  .strictObject({
    variants: z.array(ticketOfferSchema).max(100),
    basePrice: researchBasePriceSchema.nullable(),
  })
  .refine(
    (value) => value.variants.length > 0 || value.basePrice?.kind === "free",
    {
      path: ["variants"],
      message:
        "An empty offer list requires supported free full-programme admission",
    },
  );
export const ticketsOutputSchema = z.strictObject({
  currentOrNextEdition: z.strictObject({
    tickets: change(ticketBlockSchema, false).optional(),
  }),
  checks: checksSchema,
  unresolved: questionsSchema,
});
const classificationChange = z.strictObject({
  action: z.literal("set"),
  value: z.array(z.string().min(1)).max(50),
  ...common,
  reuseFrom: z
    .strictObject({ editionKey: editionKeySchema, reason: reasonSchema })
    .optional(),
});
const classificationSlot = z
  .strictObject({ classification: classificationChange.optional() })
  .nullable();
export const classificationOutputSchema = z.strictObject({
  description: change(
    z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe(
        "Current format and atmosphere in three to five sentences. Omit the festival name.",
      ),
  ).optional(),
  shortDescription: change(
    z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe(
        "Current format in one or two sentences. Omit the festival name.",
      ),
  ).optional(),
  previousEdition: classificationSlot,
  currentOrNextEdition: classificationSlot,
  checks: checksSchema,
  unresolved: questionsSchema,
});
const link = change(z.url().refine((value) => /^https?:\/\//.test(value)));
export const linksOutputSchema = z.strictObject({
  event: z.strictObject({
    website: link.optional(),
    socials: z.strictObject({
      instagram: link.optional(),
      facebook: link.optional(),
      youtube: link.optional(),
      tiktok: link.optional(),
      x: link.optional(),
      other: link.optional(),
    }),
  }),
  currentOrNextEdition: z.strictObject({ tickets: link.optional() }).nullable(),
  omitted: z
    .array(z.strictObject({ url: z.url(), reason: reasonSchema }))
    .max(100),
  checks: checksSchema,
  unresolved: questionsSchema,
});
export type TicketsOutput = z.infer<typeof ticketsOutputSchema>;
export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;
export type LinksOutput = z.infer<typeof linksOutputSchema>;
export type CollectionOutput = z.infer<typeof collectionOutputSchema>;
