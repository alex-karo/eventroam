import { z } from "zod";
import { editionKeySchema } from "../../research/contracts";
import {
  change,
  changeSupport,
  checksSchema,
  questionsSchema,
  reasonSchema,
} from "../contracts";

const classificationChange = z.strictObject({
  action: z.literal("set"),
  value: z.array(z.string().min(1)).max(50),
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
