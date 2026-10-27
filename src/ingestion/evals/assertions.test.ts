import { expect, test } from "vitest";
import { evalReport } from "@/test/eval-report";
import type { CatalogResearchResult } from "../contracts";
import type { EvalAssertion, RegressionPipelineEvalCase } from "./fixtures";
import { assertionMatches } from "./assertions";
import { scoreCase } from "./score";

const fixture: RegressionPipelineEvalCase = {
  id: "matcher",
  suite: "regression",
  origin: "synthetic",
  task: "verify",
  input: {
    mode: "refresh",
    eventId: "event:test",
    actor: "eval",
    initiatedBy: "test",
    dryRun: true,
  },
  initial: {
    event: {
      id: "event:test",
      slug: "test-festival",
      canonicalName: "Test Festival",
      editions: [
        { id: "edition:saved", editionKey: "saved", editionYear: 2027 },
      ],
    },
  },
  sources: [],
  expectations: {
    required: [
      {
        owner: "event",
        field: "links",
        contains: { kind: "official_site", url: "https://festival.example/" },
      },
    ],
    forbidden: [
      {
        owner: "event",
        field: "links",
        contains: { url: "https://sibling.example/" },
      },
    ],
  },
};

function change(subject: string, field: string, newValue: unknown) {
  return { subject, field, oldValue: null, newValue, explanations: [] };
}
const official = {
  ...change("event:test", "links", null),
  newValue: [{ kind: "official_site", url: "https://festival.example/" }],
};

test("regression scoring rejects unsupported report versions", () => {
  for (const schemaVersion of [1, 2, 3, 4, 5, undefined]) {
    expect(() =>
      scoreCase(fixture, {
        ...evalReport(),
        schemaVersion,
      } as unknown as CatalogResearchResult),
    ).toThrow(`Unsupported catalog report version: ${schemaVersion}`);
  }
});

test("required and forbidden mutations retain their diagnostics", () => {
  const missing = scoreCase(fixture, evalReport());
  expect(missing).toMatchObject({
    completeness: 0,
    correctness: 1,
    passed: false,
  });
  expect(missing.required).toEqual([
    { assertion: fixture.expectations.required[0], matched: false },
  ]);
  expect(missing.diagnostics.completeness).toEqual([
    'Missing required change: event.links contains {"kind":"official_site","url":"https://festival.example/"}',
  ]);
  expect(scoreCase(fixture, evalReport([official])).passed).toBe(true);
  const wrong = scoreCase(
    fixture,
    evalReport([
      {
        ...official,
        newValue: [
          ...official.newValue,
          { kind: "official_site", url: "https://sibling.example/" },
        ],
      },
    ]),
  );
  expect(wrong).toMatchObject({
    completeness: 1,
    correctness: 0,
    passed: false,
  });
  expect(wrong.diagnostics.correctness).toEqual([
    'Forbidden change: event.links contains {"url":"https://sibling.example/"}',
  ]);
});

test("partial research can pass mutations but failed research and catalog outcomes cannot", () => {
  const partial = {
    ...evalReport([official]),
    researchStatus: "partial" as const,
    unresolved: [{ message: "Optional detail is unknown" }],
  };
  expect(scoreCase(fixture, partial).passed).toBe(true);
  for (const failure of [
    { researchStatus: "failed" as const },
    { outcome: "failed" as const },
  ]) {
    const score = scoreCase(fixture, { ...partial, ...failure });
    expect(score).toMatchObject({
      completeness: 1,
      correctness: 1,
      passed: false,
    });
    expect(score.research.score).toBeLessThan(1);
  }
});

test("Edition mutations follow key, Event, and writer reference rather than year alone", () => {
  const created = evalReport([
    change("edition:new", "event_id", "event:test"),
    change("edition:new", "edition_key", "new-programme"),
    change("edition:new", "edition_year", 2027),
    change("edition:new", "starts_on", "2027-07-28"),
  ]);
  const next: EvalAssertion = {
    owner: "edition",
    editionKey: "new-programme",
    editionYear: 2027,
    field: "starts_on",
    value: "2027-07-28",
  };
  const saved: EvalAssertion = {
    owner: "edition",
    editionKey: "saved",
    field: "starts_on",
  };
  expect(assertionMatches(fixture, created, next)).toBe(true);
  expect(assertionMatches(fixture, created, saved)).toBe(false);
  const retained = evalReport([
    change("edition:saved", "starts_on", "2027-07-28"),
  ]);
  expect(assertionMatches(fixture, retained, saved)).toBe(true);
  expect(assertionMatches(fixture, retained, next)).toBe(false);
  expect(assertionMatches(fixture, { ...created, references: {} }, next)).toBe(
    false,
  );
  const unrelated = structuredClone(created);
  const op = unrelated.operations[0];
  if (op.kind !== "createEdition") {
    throw new Error("Test needs a created Edition");
  }
  op.eventId = "event:other";
  expect(assertionMatches(fixture, unrelated, next)).toBe(false);
});

test.each([
  ["https://festival.example/", "official_site", true],
  ["https://festival.example/en/", "official_site", true],
  ["https://festival.example/", "other", false],
  ["https://unrelated.example/", "official_site", false],
])("link alternatives check URL %s and kind %s", (url, kind, matched) => {
  const assertion: EvalAssertion = {
    owner: "event",
    field: "links",
    containsAny: [
      { kind: "official_site", url: "https://festival.example/" },
      { kind: "official_site", url: "https://festival.example/en/" },
    ],
  };
  expect(
    assertionMatches(
      fixture,
      evalReport([change("event:test", "links", [{ kind, url }])]),
      assertion,
    ),
  ).toBe(matched);
});

test("negative values allow omission and text matching ignores case and repeated spaces", () => {
  const country: EvalAssertion = {
    owner: "edition",
    editionKey: "saved",
    field: "country_code",
    notValue: "DK",
  };
  for (const [value, matched] of [
    ["DK", false],
    [null, false],
    ["DE", true],
  ] as const) {
    expect(
      assertionMatches(
        fixture,
        evalReport([change("edition:saved", "country_code", value)]),
        country,
      ),
    ).toBe(matched);
  }
  const office: EvalAssertion = {
    owner: "edition",
    editionKey: "saved",
    field: "venue_address",
    containsText: "Office Street",
  };
  for (const [value, matched] of [
    ["OFFICE   STREET 7", true],
    ["Festival Road 19", false],
    [null, false],
  ] as const) {
    expect(
      assertionMatches(
        fixture,
        evalReport([change("edition:saved", "venue_address", value)]),
        office,
      ),
    ).toBe(matched);
  }
});

test("targeted preservation allows unrelated terms but rejects saved date changes", () => {
  const item = {
    ...fixture,
    expectations: {
      required: fixture.expectations.required,
      forbidden: [
        { owner: "edition" as const, editionKey: "saved", field: "starts_on" },
      ],
    },
  };
  const output = evalReport([
    official,
    change("edition:saved", "terms", ["catalog:term:genre:metal"]),
  ]);
  expect(scoreCase(item, output).passed).toBe(true);
  output.changes.push(change("edition:saved", "starts_on", "2027-07-28"));
  expect(scoreCase(item, output).passed).toBe(false);
});

test("partial object matching and explicit null values retain their meaning", () => {
  const assertion: EvalAssertion = {
    owner: "event",
    field: "summary",
    notValue: "saved",
  };
  const report = (newValue: unknown) =>
    evalReport([change("event:test", "summary", newValue)]);
  expect(assertionMatches(fixture, report(null), assertion)).toBe(false);
  expect(assertionMatches(fixture, report("wrong"), assertion)).toBe(true);
  expect(
    assertionMatches(fixture, report(null), {
      owner: "event",
      field: "summary",
      value: null,
    }),
  ).toBe(true);
  expect(
    assertionMatches(fixture, report({ nested: { value: 1, extra: 2 } }), {
      owner: "event",
      field: "summary",
      value: { nested: { value: 1 } },
    }),
  ).toBe(true);
});
