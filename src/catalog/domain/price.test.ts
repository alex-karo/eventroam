import { expect, test } from "vitest";
import { validateStoredPrice } from "./price";

const paid = {
  priceKind: "exact",
  priceCurrency: "EUR",
  priceMinMinor: 100,
  priceMaxMinor: 100,
  priceCoverage: "full_programme",
};

test("price variants preserve the existing complete-block contract", () => {
  validateStoredPrice({});
  validateStoredPrice({ priceKind: null, priceQualification: null });
  validateStoredPrice(paid);
  validateStoredPrice({ ...paid, priceKind: "from", priceCoverage: "day" });
  validateStoredPrice({
    ...paid,
    priceKind: "range",
    priceMaxMinor: 200,
    priceCoverage: "package",
  });
  validateStoredPrice({
    priceKind: "free",
    priceMinMinor: 0,
    priceMaxMinor: 0,
    priceCoverage: "full_programme",
    priceCurrency: null,
    priceQualification: "x".repeat(500),
  });
});

test.each([
  { priceCurrency: "EUR" },
  { priceQualification: "stray" },
  { ...paid, priceKind: null },
  { ...paid, priceCoverage: null },
  { ...paid, priceKind: "future" },
  { ...paid, priceKind: "range" },
  { ...paid, priceMaxMinor: 200 },
  { ...paid, priceMinMinor: -1 },
  { ...paid, priceMinMinor: 1.5 },
  { ...paid, priceMaxMinor: null },
  { ...paid, priceCurrency: "eur" },
  { ...paid, priceCurrency: "EU" },
  { ...paid, priceCoverage: "future" },
  { ...paid, priceQualification: "x".repeat(501) },
  { ...paid, priceKind: "free", priceMinMinor: 0, priceMaxMinor: 0 },
  {
    priceKind: "free",
    priceCurrency: null,
    priceMinMinor: null,
    priceMaxMinor: 0,
    priceCoverage: "full_programme",
  },
  {
    priceKind: "free",
    priceMinMinor: 0,
    priceMaxMinor: 0,
    priceCoverage: "day",
  },
])("invalid stored price is rejected: %j", (record) => {
  expect(() => validateStoredPrice(record)).toThrow();
});
