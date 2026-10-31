import { z } from "zod";
import {
  editionFindingSchema,
  researchBasePriceSchema,
  researchQuestionSchema,
  ticketVariantSchema,
} from "../research/contracts";

export const reasonSchema = z.string().trim().min(1).max(2000);
export const supportSchema = z.array(z.string().min(1)).max(100);
const common = { reason: reasonSchema, evidenceIds: supportSchema };
export function change<T extends z.ZodType>(value: T, clearable = true) {
  const set = z.strictObject({ action: z.literal("set"), value, ...common });
  return clearable
    ? z.union([set, z.strictObject({ action: z.literal("clear"), ...common })])
    : set;
}
const facts = editionFindingSchema.shape;
export const generalFieldsSchema = z.strictObject({
  year: change(facts.year.unwrap().shape.value, false).optional(),
  dates: change(facts.dates.unwrap().shape.value.unwrap()).optional(),
  scheduleStatus: change(
    facts.scheduleStatus.unwrap().shape.value,
    false,
  ).optional(),
  displayName: change(z.string().min(1).max(250)).optional(),
  sizeEstimate: change(z.number().int().positive()).optional(),
});
const check = z.strictObject({
  check: z.string().min(1).max(100),
  finding: z.enum(["verified", "unfinished"]),
  explanation: reasonSchema,
  evidenceIds: supportSchema,
  sourceIds: z.array(z.string()).max(100),
});
export const checksSchema = z.array(check).max(40);
export const questionsSchema = z.array(researchQuestionSchema).max(30);
export const collectionOutputSchema = z.strictObject({
  checks: checksSchema,
  completionReason: reasonSchema,
  unresolved: questionsSchema,
});
export const targetSchema = z.strictObject({
  editionKey: facts.key,
  reason: reasonSchema,
  evidenceIds: supportSchema,
  fields: generalFieldsSchema,
});
const identity = {
  eventId: z.string().min(1).nullable(),
  observedEventName: z.string().trim().min(1).max(250),
  reason: reasonSchema,
  evidenceIds: supportSchema,
};
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
  }),
  z.strictObject({
    decision: z.literal("targets"),
    ...identity,
    event: z.strictObject({
      summary: change(z.string().min(1).max(2000)).optional(),
    }),
    previousEdition: targetSchema.nullable(),
    currentOrNextEdition: targetSchema.nullable(),
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

const offerFields = z
  .strictObject(ticketVariantSchema.shape)
  .omit({ url: true }).shape;
export const ingestionOfferSchema = z
  .strictObject(offerFields)
  .superRefine((value, ctx) => {
    const parsed = ticketVariantSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });
export const ticketBlockSchema = z.strictObject({
  variants: z.array(ingestionOfferSchema).min(1).max(100),
  basePrice: researchBasePriceSchema.nullable(),
});
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
    .strictObject({ editionKey: facts.key, reason: reasonSchema })
    .optional(),
});
const classificationSlot = z
  .strictObject({ classification: classificationChange.optional() })
  .nullable();
export const classificationOutputSchema = z.strictObject({
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
