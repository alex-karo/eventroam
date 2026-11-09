import type { z } from "zod";
import type { ResearchError } from "../research/contracts";
import { shrinkText } from "../runtime/logging";
import type { Role } from "./invoke";

export type ReplyValidation<T> =
  | { status: "accepted"; output: T }
  | { status: "failed"; errors: ResearchError[] }
  | { status: "retry"; errors: ResearchError[]; instructions: string };

export function validateSchema<T>(
  schema: z.ZodType<T>,
  reply: unknown,
  role: Role,
  correctionInstructions?: string,
): ReplyValidation<T> {
  const parsed = schema.safeParse(reply);
  if (parsed.success) {
    return { status: "accepted", output: parsed.data };
  }
  const rules = parsed.error.issues.slice(0, 3).map((issue) => {
    const path = shrinkText(issue.path.join("."), 200) || "reply";
    return `${path}:${issue.code} ${shrinkText(issue.message, 400)}`;
  });
  const errors: ResearchError[] = [
    {
      code: role === "editor" ? "invalid_plan" : "invalid_candidate",
      stage: role === "editor" ? "editor" : "research",
      message: `${role}: ${rules.join(", ")}`,
    },
  ];
  return correctionInstructions
    ? { status: "retry", instructions: correctionInstructions, errors }
    : { status: "failed", errors };
}
