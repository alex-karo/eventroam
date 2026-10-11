import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../../runtime/budget";
import type { ReadSourceResult } from "../../sources/contracts";
import { modelContext, promptFor } from "./input";

const source: ReadSourceResult = {
  attemptedUrl: "https://example.org/announcement",
  finalUrl: "https://example.org/2027",
  retrievedAt: "2026-10-08T12:00:00Z",
  method: "http",
  outcome: "partial",
  reason: "Only announcement text was readable",
  completeness: "partial",
  markdown: "Example Fest 2027.\n\nTicket information follows.",
  links: ["https://example.org/tickets"],
  httpStatus: 200,
  sourceTruncated: true,
};

test("saved prices in model context use major units and omit aggregate availability", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ id: "input-fest", canonicalName: "Example Fest" });
  fx.occurrence(event, {
    id: "input-edition",
    occurrenceKey: "2027",
    priceKind: "exact",
    priceCurrency: "KWD",
    priceMinMinor: 1234,
    priceMaxMinor: 1234,
    priceCoverage: "full_programme",
    priceDetails: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
  });
  const catalog = readResearchCatalog(client);
  const context = modelContext(catalog[0]);
  expect(context.editions[0].tickets).toEqual({
    variants: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
    basePrice: {
      kind: "exact",
      currency: "KWD",
      minAmount: 1.234,
      maxAmount: 1.234,
      coverage: "full_programme",
    },
  });
  expect(context.editions[0]).not.toHaveProperty("priceMinMinor");
  expect(context.editions[0]).not.toHaveProperty("ticketAvailability");
  const prompt = promptFor(
    { mode: "check", eventId: event.id, actor: "tester" },
    catalog,
    [
      {
        url: source.finalUrl,
        owner: "event",
        kind: "official_site",
        official: true,
      },
    ],
    [{ id: "music", facet: "topic", slug: "music" }],
    createResearchBudget({}, () => 0).remaining(),
    [source],
    "2026-10-08",
  );
  expect(JSON.parse(prompt).compact).not.toBeNull();
  expect(JSON.parse(prompt).remaining).toEqual({
    searches: 3,
    durationMs: 300_000,
  });
});

test.each([
  ["short", "short"],
  ["a".repeat(79_700), "a".repeat(79_700)],
  ["a".repeat(79_701), "a".repeat(79_700)],
  ["Opening paragraph.\n\n" + "a".repeat(80_000), "Opening paragraph."],
])(
  "source projection preserves metadata and paragraph boundaries (%#)",
  (markdown, expected) => {
    const prompt = JSON.parse(
      promptFor(
        { mode: "add", name: "Example Fest", actor: "tester" },
        [],
        [],
        [],
        { searches: 2, durationMs: 1_000 },
        [{ ...source, markdown }],
        "2026-10-08",
      ),
    );
    expect(prompt.inspectedSources).toEqual([
      {
        attemptedUrl: source.attemptedUrl,
        finalUrl: source.finalUrl,
        retrievedAt: source.retrievedAt,
        outcome: source.outcome,
        reason: source.reason,
        markdown: expected,
        truncated: markdown.length > expected.length,
        completeness: "partial",
      },
    ]);
  },
);

test("initial sources share the existing prompt content allowance", () => {
  const reads = [
    { ...source, markdown: "a".repeat(40_000), completeness: "full" as const },
    {
      ...source,
      markdown: "short",
      reason: undefined,
      completeness: "full" as const,
    },
  ];
  const prompt = JSON.parse(
    promptFor(
      { mode: "add", name: "Example Fest", actor: "tester" },
      [],
      [],
      [],
      { searches: 2, durationMs: 1_000 },
      reads,
      "2026-10-08",
    ),
  );
  expect(prompt.inspectedSources[0]).toMatchObject({
    markdown: "a".repeat(39_700),
    truncated: true,
    completeness: "partial",
  });
  expect(prompt.inspectedSources[1]).toEqual({
    attemptedUrl: source.attemptedUrl,
    finalUrl: source.finalUrl,
    retrievedAt: source.retrievedAt,
    outcome: source.outcome,
    markdown: "short",
    truncated: false,
    completeness: "full",
  });
});
