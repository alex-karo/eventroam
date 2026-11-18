import { z } from "zod";

export const reviewNote = z
  .string()
  .refine((note) => note.trim().length > 0, "Use a nonblank note");

export const reviewOutput = z.strictObject({
  decisions: z.array(
    z.strictObject({
      path: z.string(),
      decision: z.enum(["approve", "reject", "return"]),
      note: reviewNote,
    }),
  ),
});
export type ReviewOutput = z.infer<typeof reviewOutput>;
export type ReviewDecision = ReviewOutput["decisions"][number];
export type ReviewDecisions = Map<string, ReviewDecision>;
export type ReviewPath = {
  path: string;
  required: boolean;
  allowed: ReviewDecision["decision"][];
};
