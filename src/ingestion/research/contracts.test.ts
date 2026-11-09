import { expect, test } from "vitest";
import { dateBlockSchema } from "../roles/general/contracts";
import { editionKeySchema } from "./contracts";
import {
  researchBasePriceSchema,
  ticketOfferSchema,
} from "../roles/tickets/contracts";
import { majorToMinor, minorToMajor } from "../roles/tickets/money";

test("dates and Edition keys reject incomplete or invalid groups", () => {
  const valid = {
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
    state: "confirmed",
  };
  expect(dateBlockSchema.safeParse(valid).success).toBe(true);
  for (const value of [
    { ...valid, endsOn: "2027-06-09" },
    { ...valid, startsOn: "bad" },
    { startsOn: valid.startsOn, state: valid.state },
  ]) {
    expect(dateBlockSchema.safeParse(value).success).toBe(false);
  }
  for (const key of ["2027", "new-2027"]) {
    expect(editionKeySchema.safeParse(key).success).toBe(true);
  }
  for (const key of ["", "New 2027", "a".repeat(64)]) {
    expect(editionKeySchema.safeParse(key).success).toBe(false);
  }
});
test("money uses currency exponents and rejects excess precision and unsafe amounts", () => {
  expect(majorToMinor(100.5, "EUR")).toBe(10050);
  expect(majorToMinor(1000, "JPY")).toBe(1000);
  expect(majorToMinor(1.234, "KWD")).toBe(1234);
  expect(minorToMajor(1234, "KWD")).toBe(1.234);
  for (const [value, currency] of [
    [1.001, "EUR"],
    [1.1, "JPY"],
    [Number.MAX_SAFE_INTEGER, "EUR"],
    [1, "ZZZ"],
  ] as const) {
    expect(() => majorToMinor(value, currency)).toThrow();
  }
});
test.each([
  [
    {
      kind: "range",
      currency: "EUR",
      minAmount: 10,
      maxAmount: 20,
      coverage: "full_programme",
    },
    true,
  ],
  [
    {
      kind: "range",
      currency: "EUR",
      minAmount: 20,
      maxAmount: 10,
      coverage: "full_programme",
    },
    false,
  ],
  [
    {
      kind: "exact",
      currency: "EUR",
      minAmount: 10,
      maxAmount: 20,
      coverage: "full_programme",
    },
    false,
  ],
  [
    {
      kind: "exact",
      currency: "EUR",
      minAmount: 1.001,
      maxAmount: 1.001,
      coverage: "full_programme",
    },
    false,
  ],
  [{ kind: "free", coverage: "full_programme" }, true],
  [{ kind: "free", currency: "EUR", coverage: "full_programme" }, false],
])("validates full-programme base price %j", (value, valid) => {
  expect(researchBasePriceSchema.safeParse(value).success).toBe(valid);
});
test.each([
  [{ label: "Free admission", amount: 0 }, true],
  [{ label: "Free admission", amount: 0, currency: "EUR" }, true],
  [{ label: "Unknown price" }, true],
  [{ label: "Paid ticket", amount: 10 }, false],
  [{ label: "Currency only", currency: "EUR" }, false],
  [{ label: "Free admission", amount: 0, currency: "ZZZ" }, false],
])(
  "free variant contract accepts zero without guessing currency: %j",
  (variant, valid) => {
    expect(ticketOfferSchema.safeParse(variant).success).toBe(valid);
  },
);
