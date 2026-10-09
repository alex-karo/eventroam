import Database from "better-sqlite3";
import { expect, test, vi } from "vitest";
import { loadEvalSuite } from "./fixtures";
import { seedDatabase } from "./run";

test("invalid eval assignments roll back all seed rows before closing the database", () => {
  const suite = loadEvalSuite();
  const item = structuredClone(suite.cases[0]);
  suite.terms.push({
    id: "extra-type",
    facet: "event_type",
    slug: "extra",
    name: "Extra",
  });
  const originalType = suite.terms.find(
    (term) => term.facet === "event_type" && term.id !== "extra-type",
  )!;
  item.initial.event.occurrences[0].termIds = [originalType.id, "extra-type"];
  const counts: number[] = [];
  const close = Database.prototype.close;
  const spy = vi
    .spyOn(Database.prototype, "close")
    .mockImplementation(function (this: Database.Database) {
      for (const table of [
        "taxonomy_terms",
        "events",
        "occurrences",
        "occurrence_terms",
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
    expect(counts).toEqual([0, 0, 0, 0, 0]);
  } finally {
    spy.mockRestore();
  }
});

test("eval data cannot bypass publication and date-state rules", () => {
  const suite = loadEvalSuite();
  const item = structuredClone(suite.cases[0]);
  item.initial.event.occurrences[0] = {
    id: "bad-edition",
    occurrenceKey: "2027",
    startsOn: "2027-01-01",
    endsOn: "2027-01-02",
    dateState: "unknown",
  };
  expect(() => seedDatabase(suite, item)).toThrow(/Date state/);
  item.initial.event.publicationState = "published";
  item.initial.event.homeScope = null;
  expect(() => seedDatabase(suite, item)).toThrow(/home scope/);
});

test("validated saved-price fixtures retain original variant and primary units", () => {
  const suite = loadEvalSuite();
  const item = structuredClone(suite.cases[0]);
  item.initial.event.occurrences[0].tickets = {
    variants: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "closed",
      },
    ],
    basePrice: {
      kind: "exact",
      currency: "KWD",
      minAmount: 1.234,
      maxAmount: 1.234,
      coverage: "full_programme",
    },
  };
  const connection = seedDatabase(suite, item);
  try {
    const row = connection.client
      .prepare(
        "SELECT price_min_minor, price_details FROM occurrences WHERE id = ?",
      )
      .get(item.initial.event.occurrences[0].id) as {
      price_min_minor: number;
      price_details: string;
    };
    expect(row.price_min_minor).toBe(1234);
    expect(JSON.parse(row.price_details)[0].amount).toBe(1.234);
  } finally {
    connection.client.close();
  }
  item.initial.event.occurrences[0].tickets.variants[0].amount = 1.2345;
  expect(() => seedDatabase(suite, item)).toThrow();
});
