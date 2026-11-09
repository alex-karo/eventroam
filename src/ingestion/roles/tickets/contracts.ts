import { z } from "zod";
import { currency } from "@/catalog/domain/price";
import { ticketAvailabilities } from "@/catalog/domain/vocabulary";
import { change, checksSchema, questionsSchema } from "../contracts";
import { majorToMinor } from "./money";

const amount = z.number().nonnegative();
const monetaryAmount = (code: string, value: number) => {
  try {
    majorToMinor(value, code);
    return true;
  } catch {
    return false;
  }
};
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
export const ticketBlockSchema = z
  .strictObject({
    variants: z.array(ticketOfferSchema).max(100),
    basePrice: researchBasePriceSchema.nullable(),
  })
  .refine(
    (value) => value.variants.length > 0 || value.basePrice?.kind === "free",
    {
      path: ["variants"],
      message:
        "An empty offer list requires supported free full-programme admission",
    },
  );
export const ticketsOutputSchema = z.strictObject({
  currentOrNextEdition: z.strictObject({
    tickets: change(ticketBlockSchema, false).optional(),
  }),
  checks: checksSchema,
  unresolved: questionsSchema,
});
export type TicketsOutput = z.infer<typeof ticketsOutputSchema>;
