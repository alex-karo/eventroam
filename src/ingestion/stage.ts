import { z } from "zod";
import {
  researchErrorSchema,
  researchQuestionSchema,
} from "./research/contracts";

export const planDiagnosticsSchema = z.object({
  validation: z.object({
    structural: z.enum(["passed", "failed"]),
    target: z.enum(["passed", "failed", "not_run"]),
  }),
  errors: z.array(researchErrorSchema),
  validationIssues: z
    .array(
      z.object({
        code: z.string(),
        field: z.string(),
        stage: z.literal("validation"),
      }),
    )
    .optional(),
  unresolved: z.array(researchQuestionSchema),
  matchedEventId: z.string().optional(),
  eventNameMismatch: z
    .object({
      eventId: z.string(),
      storedName: z.string(),
      observedName: z.string(),
    })
    .nullable(),
});
export type PlanDiagnostics = z.output<typeof planDiagnosticsSchema>;

export type StageResult<T> =
  | { status: "continue"; value: T }
  | { status: "skip" | "reject"; diagnostics: PlanDiagnostics };

export function stageDiagnostics<T extends PlanDiagnostics>(
  result: StageResult<T>,
): PlanDiagnostics {
  return result.status === "continue"
    ? diagnosticsOnly(result.value)
    : result.diagnostics;
}

export function diagnosticsOnly({
  validation,
  errors,
  validationIssues,
  unresolved,
  matchedEventId,
  eventNameMismatch,
}: PlanDiagnostics): PlanDiagnostics {
  return {
    validation,
    errors,
    validationIssues,
    unresolved,
    matchedEventId,
    eventNameMismatch,
  };
}
export const initialDiagnostics = (): PlanDiagnostics => ({
  validation: { structural: "passed", target: "passed" },
  errors: [],
  unresolved: [],
  eventNameMismatch: null,
});
export function rejectProposal(
  diagnostics: PlanDiagnostics,
  message: string,
  code:
    "invalid_plan" | "editor_rejected" | "country_conflict" = "invalid_plan",
  url?: string,
): StageResult<never> {
  return {
    status: "reject",
    diagnostics: {
      ...diagnosticsOnly(diagnostics),
      errors: [
        ...diagnostics.errors,
        {
          code,
          stage: code === "editor_rejected" ? "editor" : "validation",
          message,
          ...(url ? { url } : {}),
        },
      ],
    },
  };
}
