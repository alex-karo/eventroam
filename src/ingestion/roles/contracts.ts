import { z } from "zod";
import type { topics } from "../evidence/contracts";
import { researchQuestionSchema } from "../research/contracts";

export const roleEvidenceTopics = {
  general: ["identity", "description", "dates", "status", "size", "location"],
  tickets: ["tickets", "dates", "identity", "location"],
  classification: ["classification", "description", "dates"],
  links: ["links", "tickets", "identity"],
} as const satisfies Record<string, readonly (typeof topics)[number][]>;

export const reasonSchema = z
  .string()
  .trim()
  .min(1)
  .describe(
    "Explain the decision in 1-3 short sentences, normally under 2000 characters.",
  );
export const supportSchema = z.array(z.string().min(1)).max(100);
export const changeSupport = {
  reason: reasonSchema,
  evidenceIds: supportSchema,
};
const setChange = <T extends z.ZodType>(value: T) =>
  z.strictObject({ action: z.literal("set"), value, ...changeSupport });
const clearChange = z.strictObject({
  action: z.literal("clear"),
  ...changeSupport,
});
export function change<T extends z.ZodType>(
  value: T,
  clearable: false,
): ReturnType<typeof setChange<T>>;
export function change<T extends z.ZodType>(
  value: T,
  clearable?: true,
): z.ZodUnion<[ReturnType<typeof setChange<T>>, typeof clearChange]>;
export function change<T extends z.ZodType>(value: T, clearable = true) {
  const set = setChange(value);
  return clearable ? z.union([set, clearChange]) : set;
}
export const checkFindingSchema = z.strictObject({
  check: z.string().min(1).max(100),
  finding: z.enum(["verified", "unfinished"]),
  explanation: reasonSchema,
  evidenceIds: supportSchema,
  sourceIds: z.array(z.string()).max(100),
});
export const checksSchema = z.array(checkFindingSchema).max(40);
export type CheckFinding = z.infer<typeof checkFindingSchema>;
export const questionsSchema = z.array(researchQuestionSchema).max(30);
