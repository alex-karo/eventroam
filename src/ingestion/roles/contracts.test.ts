import { expect, it } from "vitest";
import {
  collectionOutputSchema,
  generalOutputSchema,
  refreshGeneralOutputSchema,
  ticketBlockSchema,
} from "./contracts";

const collected = { check: "identity", blocker: null, sourceIds: ["s1"] };
const blocked = {
  check: "currentTickets",
  sourceIds: ["s2"],
  blocker: "The ticket page is blocked.",
};

it("retains acquisition blockers and distinct owner questions without semantic findings", () => {
  const output = {
    checks: [collected, blocked],
    unresolved: [{ message: "Which official domain is correct?" }],
  };
  expect(collectionOutputSchema.parse(output)).toEqual(output);
  const withoutCause = {
    check: blocked.check,
    sourceIds: blocked.sourceIds,
    blocker: "   ",
  };
  expect(
    collectionOutputSchema.safeParse({ checks: [withoutCause], unresolved: [] })
      .success,
  ).toBe(false);
  expect(
    collectionOutputSchema.safeParse({
      checks: [
        {
          ...blocked,
          blocker: "x".repeat(301),
        },
      ],
      unresolved: [],
    }).success,
  ).toBe(true);
});

it.each([
  { checks: [collected], unresolved: [], completionReason: "Done" },
  { checks: [{ ...collected, evidenceIds: [] }], unresolved: [] },
  { checks: [{ ...collected, finding: "verified" }], unresolved: [] },
  {
    checks: [
      {
        ...collected,
        blocker: { explanation: "The ticket page is blocked." },
      },
    ],
    unresolved: [],
  },
  {
    checks: [{ ...collected, explanation: "Already covered by the source." }],
    unresolved: [],
  },
  {
    checks: [collected],
    unresolved: [{ message: "Which domain?", editionKey: "2027" }],
  },
  {
    checks: [collected],
    unresolved: [{ message: "Which domain?", field: "website" }],
  },
])("rejects removed Research fields: %j", (output) => {
  expect(collectionOutputSchema.safeParse(output).success).toBe(false);
});

it("allows duplicate adds but excludes a duplicate decision during refresh", () => {
  const duplicate = {
    decision: "duplicate",
    eventId: "existing",
    observedEventName: "Festival",
    reason: "Official identity matches",
    evidenceIds: ["s1-e1"],
  };
  expect(generalOutputSchema.safeParse(duplicate).success).toBe(true);
  expect(refreshGeneralOutputSchema.safeParse(duplicate).success).toBe(false);
  expect(
    refreshGeneralOutputSchema.safeParse({
      decision: "uncertain",
      reason: "Source identity is unclear",
      unresolved: [],
    }).success,
  ).toBe(true);
});

it("accepts free full-programme admission without invented ticket offers", () => {
  expect(
    ticketBlockSchema.parse({
      variants: [],
      basePrice: { kind: "free", coverage: "full_programme" },
    }),
  ).toEqual({
    variants: [],
    basePrice: { kind: "free", coverage: "full_programme" },
  });
});

it.each([
  null,
  {
    kind: "exact",
    currency: "EUR",
    minAmount: 0,
    maxAmount: 0,
    coverage: "full_programme",
  },
  {
    kind: "from",
    currency: "EUR",
    minAmount: 100,
    maxAmount: 100,
    coverage: "full_programme",
  },
])(
  "rejects empty ticket offers without an explicit free base price: %j",
  (basePrice) => {
    expect(
      ticketBlockSchema.safeParse({ variants: [], basePrice }).success,
    ).toBe(false);
  },
);

import { expectTypeOf } from "vitest";
import { z } from "zod";
import { generalFieldsSchema, ticketsOutputSchema } from "./contracts";
import { editionKeySchema } from "../research/contracts";
import { modelOutputSchema } from "../runtime/model-output";
it("exposes key syntax to the model and retains strict local validation", () => {
  const wire = modelOutputSchema(z.strictObject({ key: editionKeySchema }));
  expect(JSON.stringify(wire)).toContain("1-63 lowercase ASCII");
  expect(editionKeySchema.safeParse("edition:2027").success).toBe(false);
  expect(editionKeySchema.parse("2027-weekend-2")).toBe("2027-weekend-2");
});
it("keeps set-only actions in inferred role types", () => {
  type Fields = z.infer<typeof generalFieldsSchema>;
  type Tickets = z.infer<typeof ticketsOutputSchema>;
  expectTypeOf<NonNullable<Fields["year"]>["action"]>().toEqualTypeOf<"set">();
  expectTypeOf<
    NonNullable<Fields["scheduleStatus"]>["action"]
  >().toEqualTypeOf<"set">();
  expectTypeOf<
    NonNullable<Tickets["currentOrNextEdition"]["tickets"]>["action"]
  >().toEqualTypeOf<"set">();
});
