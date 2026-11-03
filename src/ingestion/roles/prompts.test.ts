import { expect, it } from "vitest";
import {
  classificationInstructions,
  editorInstructions,
  ticketsInstructions,
} from "./prompts";
import { ticketBlockSchema } from "./contracts";

it.each([classificationInstructions, editorInstructions])(
  "supplies the same required classification policy to each role",
  (instructions) => {
    expect(instructions).toContain(
      "at most one event_type and at most one format",
    );
    expect(instructions).toContain(
      "main programme comes from participants' contributions",
    );
    expect(instructions).toContain(
      "prefer festival if the organizer explicitly calls",
    );
    expect(instructions).toContain("mixed takes precedence");
  },
);

it("preserves a free concession without a currency beside paid admission", () => {
  expect(ticketsInstructions).toContain(
    "For an explicitly free offer, retain amount: 0; currency is optional.",
  );
  const block = {
    variants: [
      { label: "Regular", amount: 100, currency: "EUR" },
      {
        label: "Personal assistant",
        amount: 0,
        terms: "Eligible companions only",
      },
    ],
    basePrice: {
      kind: "exact",
      currency: "EUR",
      minAmount: 100,
      maxAmount: 100,
      coverage: "full_programme",
    },
  };
  expect(ticketBlockSchema.parse(block)).toEqual(block);
});
