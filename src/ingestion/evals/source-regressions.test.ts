import { expect, test } from "vitest";
import { fixtureEditorPlan, runFixtureResearch } from "@/test/ingestion";
import type { ResearchCandidate } from "../research/contracts";
import { loadEvalSuite } from "./fixtures";
import { fixedSources, seedDatabase } from "./run";
import { scoreCase } from "./score";

test("known-offer eval accepts qualified variants and catches a dropped price", async () => {
  const suite = loadEvalSuite();
  const item = suite.cases.find(
    (c) => c.id === "source-known-offers-blocked-checkout",
  )!;
  const connection = seedDatabase(suite, item);
  const candidate: ResearchCandidate = {
    status: "partial",
    data: {
      eventName: item.initial.event.canonicalName,
      sources: [
        {
          url: item.sources[0].finalUrl,
          information:
            "Published partial-programme offers; checkout and currency check remain unresolved.",
        },
      ],
      links: { socials: {} },
      editions: [
        {
          key: "2027",
          links: {},
          tickets: {
            value: {
              basePrice: null,
              variants: [
                {
                  label: "Three-concert pass",
                  amount: 9.99,
                  currency: "GBP",
                  terms: "Three paid concerts only",
                  availability: "unknown",
                },
                {
                  label: "Stay package",
                  amount: 899,
                  currency: "GBP",
                  terms: "Lodging and three concerts only",
                  availability: "unknown",
                },
              ],
            },
            reason:
              "Published offers do not cover the full programme. The dollar price has no verified currency.",
          },
        },
      ],
    },
    errors: [],
    unresolved: [
      {
        editionKey: "2027",
        field: "tickets",
        message: "Checkout unavailable; dollar currency unknown.",
      },
    ],
  };
  try {
    const result = await runFixtureResearch(item.input, {
      client: connection.client,
      todayUtc: item.todayUtc,
      ...fixedSources(item, item.todayUtc!),
      generateCandidate: async () => candidate,
    });
    expect(scoreCase(item, result).passed).toBe(true);
    const dropped = {
      ...result,
      changes: result.changes.filter((c) => c.field !== "price_details"),
    };
    expect(scoreCase(item, dropped).passed).toBe(false);
    const guessed = {
      ...result,
      changes: [
        ...result.changes,
        {
          subject: item.initial.event.editions[0].id,
          field: "price_details",
          oldValue: [],
          newValue: [
            { label: "All-programme pass", amount: 615.35, currency: "USD" },
          ],
          explanations: [],
        },
      ],
    };
    expect(scoreCase(item, guessed).passed).toBe(false);
    const variants = candidate.data!.editions[0].tickets!.value.variants;
    for (const availability of [
      undefined,
      "unknown",
      "available",
      "sold_out",
      "closed",
    ] as const) {
      const modified = {
        ...result,
        changes: result.changes.map((change) =>
          change.field === "price_details"
            ? {
                ...change,
                newValue: variants.map((variant) => {
                  const next = { ...variant };
                  if (availability === undefined) {
                    delete next.availability;
                  } else {
                    next.availability = availability;
                  }
                  return next;
                }),
              }
            : change,
        ),
      };
      expect(
        scoreCase(item, modified).passed,
        `availability=${availability}`,
      ).toBe(availability === undefined || availability === "unknown");
    }
  } finally {
    connection.client.close();
  }
});

test("stale-language eval rejects an editor downgrade of confirmed dates", async () => {
  const suite = loadEvalSuite();
  const item = suite.cases.find(
    (c) => c.id === "source-stale-language-other-programme",
  )!;
  const connection = seedDatabase(suite, item);
  const dates = {
    startsOn: "2027-01-23",
    endsOn: "2027-01-30",
    state: "confirmed" as const,
  };
  const candidate: ResearchCandidate = {
    status: "partial",
    data: {
      eventName: item.initial.event.canonicalName,
      sources: [
        {
          url: item.sources[0].finalUrl,
          information:
            "Current Student dates are confirmed; booking interface remains unreadable.",
        },
      ],
      links: { socials: {} },
      editions: [
        {
          key: "2027",
          dates: {
            value: dates,
            reason: "Current official programme confirms these dates",
          },
          links: { tickets: "https://snow-meadow.example/hu/student/booking" },
        },
      ],
    },
    errors: [],
    unresolved: [
      {
        editionKey: "2027",
        field: "tickets",
        message: "Current booking interface did not load",
      },
    ],
  };
  const deps = {
    client: connection.client,
    todayUtc: item.todayUtc,
    ...fixedSources(item, item.todayUtc!),
    generateCandidate: async () => candidate,
  };
  try {
    const baseline = await runFixtureResearch(item.input, deps);
    expect(scoreCase(item, baseline).passed).toBe(true);
    const downgraded = await runFixtureResearch(item.input, {
      ...deps,
      generateEditor: async (prompt) => {
        const { research, catalog } = JSON.parse(prompt);
        const plan = fixtureEditorPlan(research, catalog);
        plan.editions[0].fields.dates = {
          action: "set",
          value: { ...dates, state: "provisional" },
          reason: "Unsupported downgrade",
        };
        return plan;
      },
    });
    expect(downgraded.changes).toContainEqual(
      expect.objectContaining({
        field: "date_state",
        oldValue: "confirmed",
        newValue: "provisional",
      }),
    );
    const score = scoreCase(item, downgraded);
    expect(score.passed).toBe(false);
    expect(score.research?.score).toBe(1);
    expect(score.reasons.violatedForbidden).toContainEqual(
      expect.objectContaining({ field: "date_state" }),
    );
  } finally {
    connection.client.close();
  }
});
