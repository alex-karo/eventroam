import { expect, it } from "vitest";
import { classificationInstructions } from "./classification/prompt";
import { editorInstructions } from "./editor/prompt";
import { ticketsInstructions } from "./tickets/prompt";
import { ticketBlockSchema } from "./tickets/contracts";

it.each([classificationInstructions, editorInstructions])(
  "supplies the same required classification policy to each role",
  (instructions) => {
    expect(instructions).toContain(
      "at most one event_type and at most one format",
    );
    expect(instructions).toContain(
      "Apply the descriptions in the supplied vocabulary",
    );
    expect(instructions).toContain(
      "prefer festival if the organizer explicitly calls",
    );
    expect(instructions).toContain(
      "Give direct evidence about the current Edition's main programme setting priority over the festival name",
    );
  },
);

it("preserves a free concession without a currency beside paid admission", () => {
  expect(ticketsInstructions).toContain(
    "For an explicitly free offer, set amount to 0. Currency is optional for a free offer.",
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
