import { expect, test } from "vitest";
import { normalizeRoleWire } from "./wire";

test("restores known optional placeholders and preserves clear actions and required nulls", () => {
  const raw = {
    decision: "targets",
    eventId: null,
    event: { summary: { action: "clear", reason: "Removed", evidenceIds: [] } },
    previousEdition: null,
    currentOrNextEdition: {
      fields: { year: null, dates: { action: "set", value: null } },
    },
    unresolved: [{ message: "Unknown", editionKey: null, field: null }],
  };
  expect(normalizeRoleWire("general", raw)).toEqual({
    ...raw,
    currentOrNextEdition: { fields: { dates: { action: "set", value: null } } },
    unresolved: [{ message: "Unknown" }],
  });
  expect(raw.currentOrNextEdition.fields.year).toBeNull();
});
test("leaves Reader branches and collection questions unchanged", () => {
  const raw = {
    b: "value",
    x: null,
    unresolved: [{ message: "Unknown", field: null }],
  };
  expect(normalizeRoleWire("reader", raw)).toEqual(raw);
  expect(normalizeRoleWire("research", raw)).toEqual(raw);
});

test.each(["free", "exact"])(
  "validates Tickets transport placeholders for %s admission",
  async (kind) => {
    const { ticketsOutputSchema } = await import("./contracts");
    const raw = {
      currentOrNextEdition: {
        tickets: {
          action: "set",
          reason: "Official price",
          evidenceIds: [],
          value: {
            basePrice:
              kind === "free"
                ? { kind, coverage: "full_programme", qualification: null }
                : {
                    kind,
                    currency: "EUR",
                    minAmount: 100,
                    maxAmount: 100,
                    coverage: "full_programme",
                    qualification: null,
                  },
            variants: [
              {
                label: "Full pass",
                amount: null,
                currency: null,
                terms: null,
                availability: null,
              },
            ],
          },
        },
      },
      checks: [],
      unresolved: [],
    };
    const parsed = ticketsOutputSchema.parse(normalizeRoleWire("tickets", raw));
    expect(
      parsed.currentOrNextEdition.tickets?.value.basePrice,
    ).not.toHaveProperty("qualification");
    expect(parsed.currentOrNextEdition.tickets?.value.variants).toEqual([
      { label: "Full pass" },
    ]);
    expect(
      raw.currentOrNextEdition.tickets.value.basePrice.qualification,
    ).toBeNull();
  },
);
test("validates Classification and Links optional transport fields", async () => {
  const { classificationOutputSchema, linksOutputSchema } =
    await import("./contracts");
  const classification = {
    previousEdition: null,
    currentOrNextEdition: {
      classification: {
        action: "set",
        value: ["music"],
        reason: "Programme",
        evidenceIds: [],
        reuseFrom: null,
      },
    },
    checks: [],
    unresolved: [],
  };
  const parsed = classificationOutputSchema.parse(
    normalizeRoleWire("classification", classification),
  );
  expect(parsed.currentOrNextEdition?.classification).not.toHaveProperty(
    "reuseFrom",
  );
  const links = {
    event: {
      website: null,
      socials: {
        instagram: null,
        facebook: null,
        youtube: null,
        tiktok: null,
        x: null,
        other: null,
      },
    },
    currentOrNextEdition: { tickets: null },
    omitted: [],
    checks: [],
    unresolved: [],
  };
  expect(
    linksOutputSchema.parse(normalizeRoleWire("links", links)),
  ).toMatchObject({ event: { socials: {} }, currentOrNextEdition: {} });
  expect(links.event.website).toBeNull();
});
