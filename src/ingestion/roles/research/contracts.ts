import { z } from "zod";
import { checkFindingSchema } from "../contracts";

const collectionNote = z
  .string()
  .trim()
  .min(1)
  .describe("Use one short sentence, normally at most 300 characters.");
const collectionCheck = {
  check: checkFindingSchema.shape.check,
  sourceIds: checkFindingSchema.shape.sourceIds,
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
export type CollectionOutput = z.infer<typeof collectionOutputSchema>;
