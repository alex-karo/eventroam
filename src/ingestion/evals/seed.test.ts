import Database from "better-sqlite3";
import { expect, test, vi } from "vitest";
import { readResearchCatalog } from "@/catalog/read/research";
import { modelContext } from "../research/agent/input";
import { pipelineEvalCaseSchema, loadEvalSuite } from "./fixtures";
import { seedDatabase } from "./run";

test("invalid eval assignments roll back all seed rows before closing the database", () => {
  const suite = loadEvalSuite();
  const item = pipelineEvalCaseSchema.parse(suite.cases[0]);
  suite.terms.push({
    id: "extra-type",
    facet: "event_type",
    slug: "extra",
    name: "Extra",
  });
  const originalType = suite.terms.find(
    (term) => term.facet === "event_type" && term.id !== "extra-type",
  )!;
  item.initial.event.editions[0].termIds = [originalType.id, "extra-type"];
  const counts: number[] = [];
  const close = Database.prototype.close;
  const spy = vi
    .spyOn(Database.prototype, "close")
    .mockImplementation(function (this: Database.Database) {
      for (const table of [
        "events",
        "editions",
        "edition_terms",
        "external_links",
      ]) {
        counts.push(
          this.prepare(`SELECT count(*) FROM ${table}`).pluck().get() as number,
        );
      }
      return close.call(this);
    });
  try {
    expect(() => seedDatabase(suite, item)).toThrow(/Only one event_type/);
    expect(counts).toEqual([0, 0, 0, 0]);
  } finally {
    spy.mockRestore();
  }
});

test("eval data cannot bypass publication and date-state rules", () => {
  const suite = loadEvalSuite();
  const item = pipelineEvalCaseSchema.parse(suite.cases[0]);
  item.initial.event.editions[0] = {
    id: "bad-edition",
    editionKey: "2027",
    startsOn: "2027-01-01",
    endsOn: "2027-01-02",
    dateState: "unknown",
  };
  expect(() => seedDatabase(suite, item)).toThrow(/Date state/);
  item.initial.event.publicationState = "published";
  item.initial.event.homeScope = null;
  expect(() => seedDatabase(suite, item)).toThrow(/home scope/);
});

test.each(["paid", "free", "unknown"] as const)(
  "eval seeds complete %s ticket baselines",
  (kind) => {
    const suite = loadEvalSuite();
    const item = pipelineEvalCaseSchema.parse(suite.cases[0]);
    const tickets = {
      priceDetails: [
        {
          label: "Regular",
          amount: 1.234,
          currency: "KWD",
          availability: "sold_out" as const,
          terms: "Full programme; booking fee included",
        },
        {
          label: "Student",
          amount: 0,
          terms: "Student ID",
          availability: "available" as const,
        },
      ],
      basePrice:
        kind === "paid"
          ? {
              kind: "exact" as const,
              currency: "KWD",
              minMinor: 1234,
              maxMinor: 1234,
              coverage: "full_programme" as const,
              qualification: "Booking fee included",
            }
          : kind === "free"
            ? {
                kind: "free" as const,
                minMinor: 0 as const,
                maxMinor: 0 as const,
                coverage: "full_programme" as const,
              }
            : null,
    };
    item.initial.event.editions[0].tickets = tickets;
    const validated = pipelineEvalCaseSchema.parse(item);
    const connection = seedDatabase(suite, validated);
    try {
      const catalog = readResearchCatalog(connection.client);
      const saved = catalog[0].editions[0];
      expect(saved.priceDetails).toEqual(tickets.priceDetails);
      expect(saved.priceKind).toBe(tickets.basePrice?.kind ?? null);
      const model = modelContext(catalog[0]).editions[0].tickets;
      expect(model.variants).toEqual(tickets.priceDetails);
      expect(model.basePrice).toEqual(
        kind === "paid"
          ? {
              kind: "exact",
              currency: "KWD",
              minAmount: 1.234,
              maxAmount: 1.234,
              coverage: "full_programme",
              qualification: "Booking fee included",
            }
          : kind === "free"
            ? { kind: "free", coverage: "full_programme" }
            : null,
      );
      expect(suite.schemaVersion).toBe(2);
    } finally {
      connection.client.close();
    }
  },
);
