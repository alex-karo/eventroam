import { z } from "zod";
import { validateSchema } from "../validation";
import { reviewNote, type ReviewDecision, type ReviewPath } from "./contracts";

type EditorReply = {
  decisions: Record<string, Omit<ReviewDecision, "path">>;
  missingReturns?: Pick<ReviewDecision, "path" | "note">[];
};

export function editorReviewContract(paths: readonly ReviewPath[]) {
  const reviewPaths = paths
    .filter(({ required }) => required)
    .map(({ path, allowed }) => ({ path, allowed }));
  const missingGroups = paths
    .filter(({ required }) => !required)
    .map(({ path }) => path);
  const decisions = z.strictObject(
    Object.fromEntries(
      reviewPaths.map(({ path, allowed }) => [
        path,
        z.strictObject({ decision: z.enum(allowed), note: reviewNote }),
      ]),
    ),
  );
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
  const schema: z.ZodType<EditorReply> = missingGroups.length
    ? z.strictObject({ decisions, missingReturns })
    : z.strictObject({ decisions });
  return { reviewPaths, missingGroups, schema };
}

export function validateEditorReply(
  schema: ReturnType<typeof editorReviewContract>["schema"],
  reply: unknown,
) {
  return validateSchema(
    schema,
    reply,
    "editor",
    "Correct the listed errors. Return the complete reply for the same review paths and missing groups. Use the supplied evidence and saved-page results from this review.",
  );
}
