import { validateSchema } from "../validation";
import { reviewOutput, type ReviewPath } from "./contracts";

export function reviewSchema(paths: ReviewPath[]) {
  const byPath = new Map(paths.map((entry) => [entry.path, entry]));
  return reviewOutput.superRefine(({ decisions }, ctx) => {
    const seen = new Set<string>();
    for (const [index, { path, decision }] of decisions.entries()) {
      const allowed = byPath.get(path)?.allowed;
      if (!allowed || seen.has(path)) {
        ctx.addIssue({
          code: "custom",
          path: ["decisions", index, "path"],
          message: allowed
            ? `Keep only one decision for ${path}.`
            : `Remove ${path}. Use only the supplied review paths.`,
        });
      } else if (!allowed.includes(decision)) {
        ctx.addIssue({
          code: "custom",
          path: ["decisions", index, "decision"],
          message: `Use an allowed decision for ${path}. Choose ${allowed.join(" or ")}.`,
        });
      }
      seen.add(path);
    }
    for (const entry of paths) {
      if (entry.required && !seen.has(entry.path)) {
        ctx.addIssue({
          code: "custom",
          path: ["decisions"],
          message: `Add the required decision for ${entry.path}. Choose ${entry.allowed.join(" or ")}.`,
        });
      }
    }
  });
}

export function validateEditorReply(
  schema: ReturnType<typeof reviewSchema>,
  reply: unknown,
) {
  return validateSchema(
    schema,
    reply,
    "editor",
    "Correct the listed errors. Return the complete decision list for the same review paths. Use the supplied evidence and any saved-page results from this review.",
  );
}
