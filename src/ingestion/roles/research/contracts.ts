import { z } from "zod";
import { checkFindingSchema } from "../contracts";

const collectionNote = z
  .string()
  .trim()
  .min(1)
  .describe("Use one short sentence, normally at most 300 characters.");
export function buildCollectionOutputSchema(assignedKeys?: readonly string[]) {
  return z.strictObject({
    checks: z
      .array(
        z.strictObject({
          check: assignedKeys
            ? z.enum(assignedKeys)
            : checkFindingSchema.shape.check,
          sourceIds: checkFindingSchema.shape.sourceIds,
          blocker: collectionNote.nullable(),
        }),
      )
      .max(40),
    unresolved: z.array(z.strictObject({ message: collectionNote })).max(30),
  });
}

export const collectionOutputSchema = buildCollectionOutputSchema();
export type CollectionOutput = z.infer<typeof collectionOutputSchema>;
