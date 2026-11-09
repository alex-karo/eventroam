import { z } from "zod";
export const editionKeySchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(63)
  .describe(
    "Edition key: 1-63 lowercase ASCII letters or digits, with single hyphens between groups. No colons, spaces, leading or trailing hyphens. Copy an existing Edition key exactly; for a new Edition use a key such as 2027 or 2027-weekend-2.",
  );
const diagnosticMessage = z
  .string()
  .trim()
  .min(1)
  .describe("Use a short factual message, normally under 500 characters.");
export const researchQuestionSchema = z
  .object({
    message: diagnosticMessage.describe(
      "Describe the unknown question, normally under 500 characters. For partial, name the unfinished core check and its cause; merely unpublished or optional details do not require partial.",
    ),
    editionKey: editionKeySchema.optional(),
    field: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Single field name, at most 100 characters. If no single field applies, return null in structured model output and describe the question in message.",
      ),
  })
  .strict();
export const editionSlotNames = [
  "previousEdition",
  "currentOrNextEdition",
] as const;
export type ResearchStatus = "success" | "partial" | "failed";
export type ResearchQuestion = z.infer<typeof researchQuestionSchema>;
export const researchErrorSchema = z.object({
  code: z.enum([
    "source_unavailable",
    "source_unsupported",
    "source_blocked",
    "limit_reached",
    "model_failed",
    "invalid_candidate",
    "invalid_plan",
    "editor_rejected",
    "location_rejected",
    "location_failed",
    "country_conflict",
    "country_baseline_conflict",
    "write_failed",
    "workflow_failed",
    "run_persistence_failed",
  ]),
  stage: z.enum([
    "source",
    "research",
    "editor",
    "location",
    "validation",
    "write",
    "workflow",
  ]),
  message: z.string(),
  url: z.string().optional(),
  editionKey: z.string().optional(),
  field: z.string().optional(),
  diagnostic: z
    .object({
      errorTypes: z.array(z.string()),
      httpStatus: z.number().optional(),
      providerCode: z.union([z.string(), z.number()]).optional(),
      retryable: z.boolean().optional(),
    })
    .optional(),
});
export type ResearchError = z.infer<typeof researchErrorSchema>;
