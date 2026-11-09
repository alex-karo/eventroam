import { z } from "zod";
import { editionScalarSchemas } from "@/catalog/domain/edition-values";
import { scheduleStatuses } from "@/catalog/domain/vocabulary";
import { editionKeySchema } from "../../research/contracts";
import {
  change,
  checksSchema,
  questionsSchema,
  reasonSchema,
  supportSchema,
} from "../contracts";

export const dateBlockSchema = z
  .object({
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    state: z.enum(["provisional", "confirmed"]),
  })
  .strict()
  .refine(
    (value) => value.endsOn >= value.startsOn,
    "End date precedes start date",
  );
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
