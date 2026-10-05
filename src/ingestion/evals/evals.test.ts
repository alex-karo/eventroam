import { expect, test } from "vitest";
import { runEvals } from "@mastra/core/evals";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../runtime/budget";
import type { CatalogResearchResult } from "../workflow";
import { loadEvalSuite, evalCaseSchema } from "./fixtures";
import { sourceLinks } from "./source-links";
import { fixedSources, seedDatabase } from "./run";
import { assertionMatches, createEvalScorers, scoreCase } from "./score";

const suite = loadEvalSuite();
const byId = new Map(suite.cases.map((item) => [item.id, item]));
const tomorrowland = byId.get("tomorrowland")!;
const wacken = byId.get("wacken")!;

function result(
  changes: CatalogResearchResult["changes"] = [],
): CatalogResearchResult {
  return {
    mode: "refresh",
    outcome: changes.length ? "updated" : "unchanged",
    eventId: tomorrowland.initial.event.id,
    operations: [],
    receipts: [],
    references: {},
    changes,
    sources: [],
    gaps: [],
    usage: {
      ...createResearchBudget().snapshot(),
      inputTokens: 0,
      outputTokens: 0,
      modelCostUsd: null,
      searchCostUsd: 0,
    },
    modelVersion: "test",
    promptVersion: "test",
    durationMs: 0,
  };
}

test("fixed source adapter uses captured pages and blocks unknown URLs without network", async () => {
  const connection = seedDatabase(suite, tomorrowland);
  try {
    const catalog = readResearchCatalog(connection.client);
    expect(catalog.map((event) => event.canonicalName)).toContain(
      "Tomorrowland Winter",
    );
    expect(
      catalog.find((event) => event.id === tomorrowland.initial.event.id)
        ?.editions,
    ).toHaveLength(1);
    const sources = fixedSources(tomorrowland, suite.todayUtc);
    const budget = createResearchBudget();
    const known = await sources.readSource(
      tomorrowland.sources[0].attemptedUrl,
      { budget },
    );
    expect(known.markdown).toEqual(tomorrowland.sources[0].markdown);
    expect(tomorrowland.sources[0]).not.toHaveProperty("links");
    expect(
      evalCaseSchema.safeParse({
        ...tomorrowland,
        sources: [{ ...tomorrowland.sources[0], links: [] }],
      }).success,
    ).toBe(false);
    expect(known.links).toContainEqual(
      expect.objectContaining({ url: "https://winter.tomorrowland.com/" }),
    );
    expect(known).not.toHaveProperty("blocks");
    expect(known.markdown).not.toMatch(/<!-- b\d+ -->/);
    const unknown = await sources.readSource("https://unknown.example/eval", {
      budget,
    });
    expect(unknown).toMatchObject({
      outcome: "blocked",
      reason: "not_in_eval_fixture",
    });
    expect(budget.snapshot().pages).toBe(2);
  } finally {
    connection.client.close();
  }
});

test("gold checks require supported changes and reject sibling links", () => {
  expect(scoreCase(tomorrowland, result()).completeness).toBe(0);
  const official = {
    subject: tomorrowland.initial.event.id,
    field: "links",
    oldValue: [],
    newValue: [{ kind: "official_site", url: "https://www.tomorrowland.com/" }],
  };
  expect(scoreCase(tomorrowland, result([official])).passed).toBe(true);
  const winter = {
    ...official,
    newValue: [
      ...official.newValue,
      { kind: "official_site", url: "https://winter.tomorrowland.com/" },
    ],
  };
  const score = scoreCase(tomorrowland, result([winter]));
  expect(score.completeness).toBe(1);
  expect(score.correctness).toBeLessThan(1);
  expect(score.passed).toBe(false);
  expect(
    scoreCase(tomorrowland, { ...result(), outcome: "failed" }).correctness,
  ).toBe(0);
});

test("a late model failure cannot pass after an earlier accepted change", () => {
  const partial = result([
    {
      subject: tomorrowland.initial.event.id,
      field: "links",
      oldValue: [],
      newValue: [
        { kind: "official_site", url: "https://www.tomorrowland.com/" },
      ],
    },
  ]);
  const failed = scoreCase(tomorrowland, {
    ...partial,
    gaps: [{ code: "model_failed", detail: "model_failed" }],
  });
  expect(failed).toMatchObject({
    correctness: 0,
    completeness: 0,
    passed: false,
  });
  expect(
    scoreCase(tomorrowland, {
      ...partial,
      gaps: [{ code: "invalid_candidate" }],
    }).passed,
  ).toBe(false);
});

test("new and existing edition assertions map only to their own subject", () => {
  const newId = "new-wacken-2027";
  const created = {
    ...result([
      {
        subject: newId,
        field: "starts_on",
        oldValue: null,
        newValue: "2027-07-28",
      },
    ]),
    operations: [
      {
        kind: "createOccurrence",
        eventId: wacken.initial.event.id,
        tempKey: "occ_2027",
        data: { occurrenceKey: "year-2027", occurrenceYear: 2027 },
      },
    ] as CatalogResearchResult["operations"],
    references: { occ_2027: newId },
  };
  const required2027 = wacken.expectations.required.find(
    (assertion) => assertion.field === "starts_on",
  )!;
  const forbiddenOld = wacken.expectations.forbidden.find(
    (assertion) =>
      assertion.editionKey === "source-row" && assertion.field === "starts_on",
  )!;
  expect(assertionMatches(wacken, created, required2027)).toBe(true);
  expect(assertionMatches(wacken, created, forbiddenOld)).toBe(false);
  expect(
    assertionMatches(
      wacken,
      {
        ...created,
        changes: [
          {
            ...created.changes[0],
            subject: wacken.initial.event.occurrences[0].id,
          },
        ],
      },
      forbiddenOld,
    ),
  ).toBe(true);
});

test("created edition can be recovered from final writer changes in older reports", () => {
  const required2027 = wacken.expectations.required.find(
    (assertion) =>
      assertion.editionYear === 2027 && assertion.field === "starts_on",
  )!;
  const newId = "new-wacken-2027";
  const writerChanges: CatalogResearchResult["changes"] = [
    {
      subject: newId,
      field: "event_id",
      oldValue: null,
      newValue: wacken.initial.event.id,
    },
    {
      subject: newId,
      field: "occurrence_key",
      oldValue: null,
      newValue: "2027",
    },
    {
      subject: newId,
      field: "starts_on",
      oldValue: null,
      newValue: "2027-07-28",
    },
  ];
  writerChanges.push({
    subject: newId,
    field: "occurrence_year",
    oldValue: null,
    newValue: 2027,
  });
  expect(assertionMatches(wacken, result(writerChanges), required2027)).toBe(
    true,
  );
  expect(
    assertionMatches(
      wacken,
      result(
        writerChanges.map((change) =>
          change.field === "event_id"
            ? { ...change, newValue: "another-event" }
            : change,
        ),
      ),
      required2027,
    ),
  ).toBe(false);
  expect(
    assertionMatches(
      wacken,
      result(
        writerChanges.map((change) =>
          change.field === "occurrence_year"
            ? { ...change, newValue: 2028 }
            : change,
        ),
      ),
      required2027,
    ),
  ).toBe(false);
});

test("Mastra runEvals scores the final workflow output without model calls", async () => {
  const inputSchema = z.object({ caseId: z.string() });
  const step = createStep({
    id: "fixture-output",
    inputSchema,
    outputSchema: z.custom<CatalogResearchResult>(),
    execute: async () =>
      result([
        {
          subject: tomorrowland.initial.event.id,
          field: "links",
          oldValue: [],
          newValue: [
            { kind: "official_site", url: "https://www.tomorrowland.com/" },
          ],
        },
      ]),
  });
  const workflow = createWorkflow({
    id: "eval-smoke",
    inputSchema,
    outputSchema: z.custom<CatalogResearchResult>(),
  })
    .then(step)
    .commit();
  workflow.__setLogger(noopLogger);
  const mastra = new Mastra({
    workflows: { evalSmoke: workflow },
    logger: false,
  });
  const scorers = createEvalScorers([tomorrowland]);
  const evaluation = await runEvals({
    target: mastra.getWorkflow("evalSmoke"),
    data: [{ input: { caseId: tomorrowland.id } }],
    scorers: [scorers.correctness, scorers.completeness],
  });
  expect(evaluation.scores).toMatchObject({
    "catalog-correctness": 1,
    "catalog-completeness": 1,
  });
});

test("fixture links preserve Markdown destinations and context without interpreting code as links", () => {
  const links = sourceLinks(
    `## Festival 2027 tickets

[Weekend **pass**](../tickets/a_(b) "Buy") and [Details][info].

[info]: /info

\`[Fake](https://fake.example/)\`

[Unsafe](javascript:alert) [Private](https://user:pass@example.org/)`,
    "https://festival.example/2027/",
  );
  expect(links).toEqual([
    {
      url: "https://festival.example/tickets/a_(b)",
      text: "Weekend pass",
      context: expect.stringContaining("Festival 2027 tickets"),
    },
    {
      url: "https://festival.example/info",
      text: "Details",
      context: expect.stringContaining("Weekend pass"),
    },
  ]);
});

test("Roskilde permits missing location but rejects the office address", () => {
  const roskilde = byId.get("roskilde")!;
  const subject = "roskilde-2027";
  const wrongCountry = roskilde.expectations.forbidden.find(
    (assertion) => assertion.field === "country_code",
  )!;
  expect(
    roskilde.expectations.required.some((assertion) =>
      ["locality", "venue_address", "country_code"].includes(assertion.field),
    ),
  ).toBe(false);
  const base: CatalogResearchResult["changes"] = [
    {
      subject,
      field: "event_id",
      oldValue: null,
      newValue: roskilde.initial.event.id,
    },
    {
      subject,
      field: "occurrence_key",
      oldValue: null,
      newValue: "2027",
    },
  ];
  base.push({
    subject,
    field: "occurrence_year",
    oldValue: null,
    newValue: 2027,
  });
  for (const [country, forbidden] of [
    ["DK", false],
    [null, false],
    ["DE", true],
  ] as const) {
    expect(
      assertionMatches(
        roskilde,
        result([
          ...base,
          {
            subject,
            field: "country_code",
            oldValue: null,
            newValue: country,
          },
        ]),
        wrongCountry,
      ),
    ).toBe(forbidden);
  }
  const change = {
    subject,
    field: "venue_address",
    oldValue: null,
    newValue: "Darupvej 19, 4000 Roskilde",
  };
  const office = roskilde.expectations.forbidden.find(
    (assertion) => assertion.field === "venue_address",
  )!;
  for (const [value, officeMatches] of [
    ["Darupvej 19, 4000 Roskilde", false],
    ["Festivalpladsen, DARUPVEJ   19, Roskilde", false],
    ["Rabalderstræde 7, 4., 4000 Roskilde", true],
    ["Some other address", false],
    [null, false],
  ] as const) {
    const output = result([...base, { ...change, newValue: value }]);
    expect(assertionMatches(roskilde, output, office)).toBe(officeMatches);
  }
  const complete = result([
    ...base,
    ...roskilde.expectations.required.map((assertion) => ({
      subject:
        assertion.owner === "event" ? roskilde.initial.event.id : subject,
      field: assertion.field,
      oldValue: null,
      newValue:
        assertion.field === "links" ? [assertion.contains] : assertion.value,
    })),
  ]);
  expect(scoreCase(roskilde, complete).passed).toBe(true);
  expect(
    scoreCase(roskilde, {
      ...complete,
      changes: [
        ...complete.changes,
        {
          ...change,
          newValue: "Rabalderstræde 7, 4., 4000 Roskilde",
        },
      ],
    }).passed,
  ).toBe(false);
  const contact = roskilde.sources.find((source) =>
    source.finalUrl.endsWith("/kontakt"),
  )!;
  expect(contact.method).toBe("http");
  expect(contact.markdown).toContain("Darupvej 19");
});

test.each([
  ["https://www.wacken.com/", "official_site", true],
  ["https://www.wacken.com/de/", "official_site", true],
  ["https://www.wacken.com/", "other", false],
  ["https://unrelated.example/", "official_site", false],
])("Wacken official link %s (%s) matches: %s", (url, kind, matches) => {
  const assertion = wacken.expectations.required.find(
    (item) => item.field === "links",
  )!;
  expect(
    assertionMatches(
      wacken,
      result([
        {
          subject: wacken.initial.event.id,
          field: "links",
          oldValue: [],
          newValue: [{ kind, url }],
        },
      ]),
      assertion,
    ),
  ).toBe(matches);
});

test("Wacken permits metal while preserving historical dates", () => {
  const subject = "wacken-2027";
  const output = result([
    {
      subject,
      field: "event_id",
      oldValue: null,
      newValue: wacken.initial.event.id,
    },
    {
      subject,
      field: "occurrence_key",
      oldValue: null,
      newValue: "2027",
    },
    {
      subject,
      field: "occurrence_year",
      oldValue: null,
      newValue: 2027,
    },
    ...wacken.expectations.required.map((assertion) => ({
      subject: assertion.owner === "event" ? wacken.initial.event.id : subject,
      field: assertion.field,
      oldValue: null,
      newValue:
        assertion.field === "links"
          ? [assertion.containsAny![0]]
          : assertion.value,
    })),
    {
      subject,
      field: "terms",
      oldValue: [],
      newValue: ["festivalnetwork:term:genre:metal"],
    },
  ]);
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.occurrences[0].id,
    field: "terms",
    oldValue: [],
    newValue: ["festivalnetwork:term:genre:metal"],
  });
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.occurrences[0].id,
    field: "starts_on",
    oldValue: "2026-07-30",
    newValue: "2027-07-28",
  });
  expect(scoreCase(wacken, output).passed).toBe(false);
});

test("Wacken allows DE or missing country but rejects another country", () => {
  const assertion = wacken.expectations.forbidden.find(
    (a) => a.field === "country_code",
  )!;
  for (const [value, forbidden] of [
    ["DE", false],
    [null, false],
    ["DK", true],
  ] as const) {
    const subject = "wacken-2027";
    const output = result([
      {
        subject,
        field: "event_id",
        oldValue: null,
        newValue: wacken.initial.event.id,
      },
      {
        subject,
        field: "occurrence_key",
        oldValue: null,
        newValue: "2027",
      },
      {
        subject,
        field: "occurrence_year",
        oldValue: null,
        newValue: 2027,
      },
      {
        subject,
        field: "country_code",
        oldValue: null,
        newValue: value,
      },
    ]);
    expect(assertionMatches(wacken, output, assertion)).toBe(forbidden);
  }
});

test.each(["wacken", "roskilde", "sziget"])(
  "%s permits optional outdoor and structurally gated publication",
  (id) => {
    const item = byId.get(id)!;
    expect(
      item.expectations.required.some(
        (a) => a.contains === "validation:outdoor",
      ),
    ).toBe(false);
    expect(
      item.expectations.forbidden.some(
        (a) =>
          a.contains === "validation:outdoor" ||
          a.field === "publication_state",
      ),
    ).toBe(false);
  },
);
