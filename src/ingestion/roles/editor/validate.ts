import { z } from "zod";
import { validateSchema } from "../validation";
import { reviewNote, type ReviewDecision, type ReviewScope } from "./contracts";

type EditorReply = {
  decisions: Record<string, Omit<ReviewDecision, "path">>;
  missingReturns?: Pick<ReviewDecision, "path" | "note">[];
};

export function editorReplySchema({
  reviewPaths,
  missingGroups,
}: ReviewScope): z.ZodType<EditorReply> {
  const decisions = z.strictObject(
    Object.fromEntries(
      reviewPaths.map(({ path, allowed }) => [
        path,
        z.strictObject({ decision: z.enum(allowed), note: reviewNote }),
      ]),
    ),
  );
  if (!missingGroups.length) {
    return z.strictObject({ decisions });
  }
  const missingReturns = z
    .array(z.strictObject({ path: z.enum(missingGroups), note: reviewNote }))
    .superRefine((requests, ctx) => {
      const seen = new Set<string>();
      for (const [index, { path }] of requests.entries()) {
        if (seen.has(path)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "path"],
            message: `Keep only one request for ${path}.`,
          });
        }
        seen.add(path);
      }
    });
  return z.strictObject({ decisions, missingReturns });
}

export function validateEditorReply(
  schema: z.ZodType<EditorReply>,
  reply: unknown,
) {
  return validateSchema(
    schema,
    reply,
    "editor",
    "Correct the listed errors. Return the complete reply for the same review paths and missing groups. Use the supplied evidence and saved-page results from this review.",
  );
}
