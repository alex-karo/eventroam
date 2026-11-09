import { z } from "zod";
import { editionKeySchema } from "../../research/contracts";
import {
  change,
  changeSupport,
  checksSchema,
  questionsSchema,
  reasonSchema,
} from "../contracts";

export const classificationFacets = [
  ["eventType", "event_type"],
  ["format", "format"],
  ["topics", "topic"],
  ["genres", "genre"],
  ["cultures", "culture"],
] as const;

export const maxClassificationTerms = 50;
const classificationChange = z.strictObject({
  action: z.literal("set"),
  value: z.array(z.string().min(1)).max(maxClassificationTerms),
  ...changeSupport,
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
export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;

const slug = z.string().min(1);
const slugs = z.array(slug).max(maxClassificationTerms).nullish();
const classificationReplyChange = classificationChange.extend({
  value: z.strictObject({
    eventType: slug.nullish(),
    format: slug.nullish(),
    topics: slugs,
    genres: slugs,
    cultures: slugs,
  }),
});
const classificationReplySlot = z
  .strictObject({ classification: classificationReplyChange.optional() })
  .nullable();
export const classificationReplySchema = classificationOutputSchema.extend({
  previousEdition: classificationReplySlot,
  currentOrNextEdition: classificationReplySlot,
});
export type ClassificationReply = z.infer<typeof classificationReplySchema>;
export type ClassificationReplyChange = z.infer<
  typeof classificationReplyChange
>;
