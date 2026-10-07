import { z } from "zod";
import { paidPriceKinds, priceCoverages } from "./vocabulary";

export const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(
    (value) => Intl.supportedValuesOf("currency").includes(value),
    "Unknown ISO currency",
  );
export const price = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("free"),
      minMinor: z.literal(0),
      maxMinor: z.literal(0),
      coverage: z.literal("full_programme"),
      qualification: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(paidPriceKinds),
      currency,
      minMinor: z.number().int().nonnegative(),
      maxMinor: z.number().int().nonnegative(),
      coverage: z.enum(priceCoverages),
      qualification: z.string().max(500).optional(),
    })
    .strict()
    .refine((p) =>
      p.kind === "range" ? p.maxMinor > p.minMinor : p.maxMinor === p.minMinor,
    ),
]);
