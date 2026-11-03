import { z } from "zod";
import { currency } from "@/catalog/domain/price";
import { ticketAvailabilities } from "@/catalog/domain/vocabulary";
import { majorToMinor } from "./money";

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
const amount = z.number().nonnegative();
const monetaryAmount = (code: string, value: number) => {
  try {
    majorToMinor(value, code);
    return true;
  } catch {
    return false;
  }
};

export const dateBlockSchema = z
  .object({
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    state: z.enum(["provisional", "confirmed"]),
  })
  .strict()
  .refine(
    (value) => value.endsOn >= value.startsOn,
    "End date precedes start date",
  );
const paidBase = z
  .object({
    kind: z.enum(["exact", "from", "range"]),
    currency,
    minAmount: amount,
    maxAmount: amount,
    coverage: z.literal("full_programme"),
    qualification: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.kind === "range"
        ? value.maxAmount <= value.minAmount
        : value.maxAmount !== value.minAmount
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid base price bounds" });
    }
    for (const field of ["minAmount", "maxAmount"] as const) {
      if (!monetaryAmount(value.currency, value[field])) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Invalid currency precision or amount range",
        });
      }
    }
  });
const freeBase = z
  .object({
    kind: z.literal("free"),
    coverage: z.literal("full_programme"),
    qualification: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export const researchBasePriceSchema = z.union([freeBase, paidBase]);
export const ticketOfferSchema = z
  .object({
    label: z.string().trim().min(1).max(250),
    amount: amount.optional(),
    currency: currency.optional(),
    terms: z.string().trim().min(1).max(1000).optional(),
    availability: z.enum(ticketAvailabilities).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.amount !== 0 &&
      (value.amount === undefined) !== (value.currency === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Amount and currency must be supplied together",
      });
    }
    if (
      value.amount !== undefined &&
      value.currency !== undefined &&
      !monetaryAmount(value.currency, value.amount)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Invalid currency precision or amount range",
      });
    }
  });
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
