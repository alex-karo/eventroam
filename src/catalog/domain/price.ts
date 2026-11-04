import { z } from "zod";
import {
  paidPriceKinds,
  priceCoverages,
  ticketAvailabilities,
} from "./vocabulary";

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

const priceDetail = z
  .object({
    label: z.string().trim().min(1).max(250),
    amount: z.number().nonnegative().optional(),
    currency: currency.optional(),
    terms: z.string().trim().min(1).max(1000).optional(),
    availability: z.enum(ticketAvailabilities).optional(),
    url: z
      .url()
      .refine((value) => /^https?:\/\//.test(value))
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.amount === 0 ||
      (value.amount === undefined) === (value.currency === undefined),
    {
      message: "Amount and currency must be supplied together",
    },
  );

export const priceDetails = z.array(priceDetail).max(100);

/** Validate the entire stored block, including stray fields when kind is absent. */
export function validateStoredPrice(r: Record<string, unknown>) {
  const fields = [
    r.priceKind,
    r.priceCurrency,
    r.priceMinMinor,
    r.priceMaxMinor,
    r.priceCoverage,
    r.priceQualification,
  ];
  if (fields.every((value) => value == null)) {
    return;
  }
  if (r.priceKind == null) {
    throw new Error("Incomplete price block");
  }
  if (r.priceKind === "free" && r.priceCurrency != null) {
    throw new Error("Free price cannot have currency");
  }
  price.parse({
    kind: r.priceKind,
    ...(r.priceKind === "free" ? {} : { currency: r.priceCurrency }),
    minMinor: r.priceMinMinor,
    maxMinor: r.priceMaxMinor,
    coverage: r.priceCoverage,
    ...(r.priceQualification == null
      ? {}
      : { qualification: r.priceQualification }),
  });
}
