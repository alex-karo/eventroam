import { DEFAULT_RESEARCH_LIMITS } from "@/ingestion/runtime/budget";
import {
  generateFixtureEditor,
  generateFixtureLocation,
} from "@/test/ingestion";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../runtime/budget";
import type { CatalogResearchResult } from "../workflow";
import * as workflowModule from "../workflow";
import * as reportModule from "../report";
import { RunPersistenceError } from "../runs";
import { executeCatalogEvalCommand } from "../../../commands/catalog-eval";
const executeResearch = workflowModule.runCatalogResearch;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
import { loadEvalSuite, evalCaseSchema, evalSuiteSchema } from "./fixtures";
import { sourceLinks } from "./source-links";
import { fixedSources, runCatalogEvals, seedDatabase } from "./run";
import { assertionMatches } from "./assertions";
import { createEvalScorers } from "./scorers";
import { scoreCase } from "./score";
import * as scoreModule from "./score";
import * as scorersModule from "./scorers";

const suite = loadEvalSuite();
const byId = new Map(suite.cases.map((item) => [item.id, item]));
const tomorrowland = byId.get("tomorrowland")!;
const wacken = byId.get("wacken")!;
const blocked = byId.get("afro-nation-portugal-blocked")!;
const requiredLinkCase = {
  ...tomorrowland,
  expectations: {
    required: [
      {
        owner: "event" as const,
        field: "links",
        contains: {
          kind: "official_site",
          url: "https://www.tomorrowland.com/",
        },
      },
    ],
    forbidden: tomorrowland.expectations.forbidden,
  },
};

test("editor-only rejects cases without handoffs before provider setup", async () => {
  await expect(
    runCatalogEvals({ editorOnly: true, caseIds: [tomorrowland.id] }),
  ).rejects.toThrow("Editor-only eval requires a research handoff");
});

test.each([
  { editorOnly: false, caseIds: ["editor-clear"] },
  { editorOnly: false, caseIds: ["tomorrowland", "editor-recovered-website"] },
  { editorOnly: true, caseIds: ["editor-clear", "tomorrowland"] },
])("rejects incompatible explicit eval selection: %j", async (options) => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  await expect(runCatalogEvals(options)).rejects.toThrow(
    options.editorOnly
      ? "Editor-only eval requires"
      : "Pipeline eval does not accept",
  );
});

test("default pipeline excludes captured handoffs and retains full recovery", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
  vi.spyOn(workflowModule, "runCatalogResearch").mockImplementation(
    (input, deps) =>
      executeResearch(input, {
        ...deps,
        generateCandidate: async () => ({
          status: "failed",
          data: null,
          errors: [],
          unresolved: [{ message: "Injected offline selection test" }],
        }),
      }),
  );
  const report = await runCatalogEvals({ reportPath: undefined });
  expect(report.evaluationMode).toBe("pipeline");
  expect(report.results.map((row) => row.caseId).sort()).toEqual(
    suite.cases
      .filter((item) => !item.researchHandoff && !item.location)
      .map((item) => item.id)
      .sort(),
  );
  expect(
    report.results.some((row) => row.caseId === "search-wrong-official"),
  ).toBe(true);
  expect(report.results.every((row) => !row.researchHandoff)).toBe(true);
});

test("editor-only CLI replays captured research through preparation and writer without network", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Live network forbidden");
    }),
  );
  const execute = vi
    .spyOn(workflowModule, "runCatalogResearch")
    .mockImplementation((input, deps) => {
      expect(deps?.generateCandidate).toBeTypeOf("function");
      return executeResearch(input, {
        ...deps,
        generateEditor: generateFixtureEditor,
        generateLocation: generateFixtureLocation,
      });
    });
  const reports: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
  try {
    const code = await executeCatalogEvalCommand(["--editor-only"], {
      stdout: vi.fn(),
      runEvals: async (options) => {
        const report = await runCatalogEvals({
          ...options,
          reportPath: undefined,
        });
        reports.push(report);
        return report;
      },
    });
    expect(code).toBe(0);
    expect(execute).toHaveBeenCalledTimes(7);
    expect(fetch).not.toHaveBeenCalled();
    const report = reports[0];
    expect(report.evaluationMode).toBe("editor-only");
    expect(report.results.every((item) => item.output!.score.passed)).toBe(
      true,
    );
    for (const row of report.results) {
      const handoff = byId.get(row.caseId)!.researchHandoff!;
      expect(row.output!.report!.modelResponse?.object).toEqual(
        handoff.candidate,
      );
      expect(row.researchHandoff).toMatchObject({
        provenance: handoff.provenance,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

test.each(["editor-wrong-year", "editor-day-ticket", "editor-valid-update"])(
  "%s forbids clearing saved historical dates as well as replacing them",
  (id) => {
    const item = byId.get(id)!;
    const saved = item.initial.event.editions.find(
      (edition) => edition.editionKey === "source-row",
    )!;
    for (const field of ["starts_on", "ends_on"]) {
      for (const newValue of [null, "2027-01-01"]) {
        const changed = {
          ...result(),
          changes: [
            {
              subject: saved.id,
              field,
              oldValue: "2026-01-01",
              newValue,
              explanations: [],
            },
          ],
        };
        expect(
          item.expectations.forbidden.some((assertion) =>
            assertionMatches(item, changed, assertion),
          ),
        ).toBe(true);
      }
    }
  },
);

test("empty change assertions need explicit research expectations", () => {
  expect(blocked.provenance?.kind).toBe(
    "captured-http-metadata-synthetic-replay",
  );
  expect(blocked.todayUtc).toBe("2026-10-08");
  expect(
    evalCaseSchema.safeParse({
      ...tomorrowland,
      expectations: { required: [], forbidden: [] },
    }).success,
  ).toBe(false);
  expect(
    evalCaseSchema.safeParse({
      ...blocked,
      expectations: {
        ...blocked.expectations,
        required: requiredLinkCase.expectations.required,
      },
    }).success,
  ).toBe(false);
});

test("blocked-source fixture replays captured HTTP metadata without fallback", async () => {
  const source = blocked.sources[0];
  expect(source).toMatchObject({
    outcome: "blocked",
    reason: "http_403",
    completeness: "none",
    markdown: "",
  });
  const read = await fixedSources(blocked, blocked.todayUtc!).readPage(
    source.attemptedUrl,
    { budget: createResearchBudget() } as Parameters<
      ReturnType<typeof fixedSources>["readPage"]
    >[1],
  );
  expect(read).toMatchObject({ outcome: "blocked", reason: "http_403" });
});

test("failed-source research requires null data, source diagnosis, and no writes", () => {
  const sourceUrl = blocked.sources[0].attemptedUrl;
  const sourceError = {
    code: "source_blocked" as const,
    stage: "source" as const,
    message: "Official ticket page returned HTTP 403",
    url: sourceUrl,
  };
  const expected: CatalogResearchResult = {
    ...result(),
    mode: "refresh",
    eventId: blocked.initial.event.id,
    outcome: "failed",
    researchStatus: "failed",
    modelResponse: {
      text: null,
      object: {
        status: "failed",
        data: null,
        errors: [
          {
            code: "source_blocked",
            message: sourceError.message,
            url: sourceUrl,
          },
        ],
        unresolved: [],
      },
    },
    sources: [
      {
        attemptedUrl: sourceUrl,
        finalUrl: sourceUrl,
        retrievedAt: blocked.sources[0].retrievedAt,
        outcome: "blocked",
        reason: "http_403",
      },
    ],
    errors: [sourceError],
  };
  expect(scoreCase(blocked, expected)).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: true,
  });
  expect(scoreCase(blocked, expected).diagnostics).toEqual({
    execution: [],
    correctness: [],
    completeness: [],
    research: [],
    toolUse: [],
  });
  expect(
    scoreCase(blocked, {
      ...expected,
      changes: [
        {
          subject: blocked.initial.event.id,
          field: "summary",
          oldValue: null,
          newValue: "changed",
          explanations: [],
        },
      ],
    }).diagnostics.research,
  ).toEqual(["Expected no catalog changes"]);
  const missingDiagnosis = scoreCase(blocked, { ...expected, errors: [] });
  expect(missingDiagnosis).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: false,
    diagnostics: { correctness: [], completeness: [], execution: [] },
  });
  expect(missingDiagnosis.research.score).toBeLessThan(1);
  expect(missingDiagnosis.diagnostics.research).toEqual([
    "Expected a source-failure diagnosis for an unavailable inspected URL",
  ]);
  for (const invalid of [
    ...(["workflow_failed", "run_persistence_failed"] as const).map((code) => ({
      ...expected,
      errors: [
        ...expected.errors,
        { code, stage: "workflow" as const, message: "Host failed" },
      ],
    })),
    {
      ...expected,
      researchStatus: "partial" as const,
      outcome: "unchanged" as const,
    },
    {
      ...expected,
      researchStatus: "success" as const,
      outcome: "unchanged" as const,
    },
    { ...expected, modelResponse: null },
    {
      ...expected,
      modelResponse: {
        text: null,
        object: { status: "partial", data: { editions: [] } },
      },
    },
    {
      ...expected,
      modelResponse: {
        text: null,
        object: { status: "success", data: { editions: [] } },
      },
    },
    {
      ...expected,
      errors: [
        {
          code: "model_failed" as const,
          stage: "research" as const,
          message: "provider error",
        },
      ],
    },
    {
      ...expected,
      errors: [
        ...expected.errors,
        {
          code: "invalid_candidate" as const,
          stage: "validation" as const,
          message: "bad JSON",
        },
      ],
    },
    {
      ...expected,
      errors: [
        ...expected.errors,
        {
          code: "limit_reached" as const,
          stage: "source" as const,
          message: "budget exhausted",
        },
      ],
    },
    {
      ...expected,
      operations: [
        {
          kind: "publishEvent" as const,
          id: blocked.initial.event.id,
          operationKey: "publish",
          actor: "eval",
          expectedVersion: 1,
        },
      ],
    },
    {
      ...expected,
      changes: [
        {
          subject: blocked.initial.event.id,
          field: "summary",
          oldValue: null,
          newValue: "changed",
          explanations: [],
        },
      ],
    },
    {
      ...expected,
      sourceSummaries: [{ url: sourceUrl, information: "Unsupported claim" }],
    },
  ]) {
    const score = scoreCase(blocked, invalid);
    expect(score.passed).toBe(false);
    expect(
      [...score.diagnostics.research, ...score.diagnostics.execution].length,
    ).toBeGreaterThan(0);
  }
});

test("eval fixtures reject the old schema version", () => {
  expect(suite.schemaVersion).toBe(2);
  expect(
    evalSuiteSchema.safeParse({ ...suite, schemaVersion: 1 }).success,
  ).toBe(false);
});

test("eval scorer rejects unsupported result report versions", () => {
  for (const schemaVersion of [1, 2, 3, 4, 5, undefined]) {
    expect(() =>
      scoreCase(tomorrowland, {
        ...result(),
        schemaVersion,
      } as unknown as CatalogResearchResult),
    ).toThrow(`Unsupported catalog report version: ${schemaVersion}`);
  }
});

test("partial research can pass factual assertions while failed research cannot", () => {
  const official = {
    subject: tomorrowland.initial.event.id,
    field: "links",
    oldValue: [],
    explanations: [],
    newValue: [{ kind: "official_site", url: "https://www.tomorrowland.com/" }],
  };
  const partial = {
    ...result([official]),
    researchStatus: "partial" as const,
    unresolved: [{ message: "Optional dates unknown." }],
  };
  expect(scoreCase(requiredLinkCase, partial).passed).toBe(true);
  const failed = scoreCase(requiredLinkCase, {
    ...partial,
    researchStatus: "failed",
  });
  expect(failed).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: false,
  });
  expect(failed.research.score).toBeLessThan(1);
});

test("existing eval report is rejected before provider setup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "eventroam-eval-report-"));
  const reportPath = join(directory, "report.json");
  writeFileSync(reportPath, "existing report");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  try {
    await expect(
      runCatalogEvals({ caseIds: [tomorrowland.id], reportPath }),
    ).rejects.toThrow(`Eval report already exists: ${reportPath}`);
    expect(readFileSync(reportPath, "utf8")).toBe("existing report");
  } finally {
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  }
});

function result(
  changes: CatalogResearchResult["changes"] = [],
): CatalogResearchResult {
  const created = new Map<
    string,
    { eventId?: string; key?: string; year?: number }
  >();
  for (const change of changes) {
    const facts = created.get(change.subject) ?? {};
    if (change.field === "event_id" && typeof change.newValue === "string") {
      facts.eventId = change.newValue;
    }
    if (change.field === "edition_key" && typeof change.newValue === "string") {
      facts.key = change.newValue;
    }
    if (
      change.field === "edition_year" &&
      typeof change.newValue === "number"
    ) {
      facts.year = change.newValue;
    }
    created.set(change.subject, facts);
  }
  const newEditions = [...created].filter(
    ([, facts]) => facts.eventId && facts.key,
  );
  return {
    schemaVersion: 7,
    locationResponse: null,
    locationStatus: "not_run",
    locationPromptVersion: "catalog-location-v1",
    locationModelVersion: "fixture",
    geocoding: { observations: [], points: [] },
    editorResponse: null,
    editorStatus: "not_run",
    editorPromptVersion: "catalog-editor-v6",
    scope: null,
    currentDate: null,
    workload: { savedEditions: 0, returnedEditions: 0 },
    limits: DEFAULT_RESEARCH_LIMITS,
    runId: "eval-fixture-run",
    mode: "refresh",
    outcome: changes.length ? "updated" : "unchanged",
    modelResponse: null,
    researchStatus: "success",
    eventId: tomorrowland.initial.event.id,
    operations: newEditions.map(([subject, facts]) => ({
      kind: "createEdition",
      eventId: facts.eventId!,
      tempKey: subject,
      data: {
        editionKey: facts.key!,
        ...(facts.year === undefined ? {} : { editionYear: facts.year }),
      },
    })) as CatalogResearchResult["operations"],
    receipts: [],
    references: Object.fromEntries(
      newEditions.map(([subject]) => [subject, subject]),
    ),
    changes,
    sources: [],
    sourceSummaries: [],
    errors: [],
    unresolved: [],
    eventNameMismatch: null,
    budget: {
      ...createResearchBudget().snapshot(),
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
    const known = await sources.readPage(tomorrowland.sources[0].attemptedUrl, {
      budget,
    });
    expect(known.markdown).toEqual(tomorrowland.sources[0].markdown);
    expect(tomorrowland.sources[0]).not.toHaveProperty("links");
    expect(
      evalCaseSchema.safeParse({
        ...tomorrowland,
        sources: [{ ...tomorrowland.sources[0], links: [] }],
      }).success,
    ).toBe(false);
    expect(known.links).toContain("https://winter.tomorrowland.com/");
    expect(known).not.toHaveProperty("blocks");
    expect(known.markdown).not.toMatch(/<!-- b\d+ -->/);
    const unknown = await sources.readPage("https://unknown.example/eval", {
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
  const missing = scoreCase(requiredLinkCase, result());
  expect(missing.completeness).toBe(0);
  expect(missing.required).toEqual([
    { assertion: requiredLinkCase.expectations.required[0], matched: false },
  ]);
  expect(missing.diagnostics.completeness).toEqual([
    'Missing required change: event.links contains {"kind":"official_site","url":"https://www.tomorrowland.com/"}',
  ]);
  const official = {
    subject: tomorrowland.initial.event.id,
    field: "links",
    oldValue: [],
    explanations: [],
    newValue: [{ kind: "official_site", url: "https://www.tomorrowland.com/" }],
  };
  expect(scoreCase(requiredLinkCase, result([official])).passed).toBe(true);
  const winter = {
    ...official,
    newValue: [
      ...official.newValue,
      { kind: "official_site", url: "https://winter.tomorrowland.com/" },
    ],
  };
  const score = scoreCase(requiredLinkCase, result([winter]));
  expect(score.completeness).toBe(1);
  expect(score.correctness).toBeLessThan(1);
  expect(score.passed).toBe(false);
  expect(
    scoreCase(requiredLinkCase, { ...result(), outcome: "failed" }),
  ).toMatchObject({
    correctness: 1,
    completeness: 0,
    passed: false,
    diagnostics: { research: ["Catalog outcome must not be failed"] },
  });
});

test("Tomorrowland rejects Thailand sell-out on a Belgium ticket variant", () => {
  const official = {
    subject: tomorrowland.initial.event.id,
    field: "links",
    oldValue: [],
    explanations: [],
    newValue: [{ kind: "official_site", url: "https://www.tomorrowland.com/" }],
  };
  const soldOut = {
    subject: tomorrowland.initial.event.editions[0].id,
    field: "price_details",
    oldValue: [],
    explanations: [
      "Tomorrowland Thailand is marked Sold Out on the events page.",
    ],
    newValue: [
      { label: "Belgium day ticket", availability: "unknown" },
      { label: "Belgium weekend pass", availability: "sold_out" },
    ],
  };
  expect(scoreCase(requiredLinkCase, result([official]))).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: true,
  });
  const score = scoreCase(requiredLinkCase, result([official, soldOut]));
  expect(score.completeness).toBe(1);
  expect(score.correctness).toBeLessThan(1);
  expect(score.passed).toBe(false);
  expect(score.forbidden.filter((check) => check.matched)).toEqual([
    expect.objectContaining({
      assertion: expect.objectContaining({
        owner: "edition",
        field: "price_details",
        contains: { availability: "sold_out" },
      }),
    }),
  ]);
  expect(score.diagnostics.correctness).toEqual([
    'Forbidden change: edition.price_details contains {"availability":"sold_out"}',
  ]);
});

test("new and existing edition assertions map only to their own subject", () => {
  const newId = "new-wacken-2027";
  const created = {
    ...result([
      {
        subject: newId,
        field: "starts_on",
        oldValue: null,
        explanations: [],
        newValue: "2027-07-28",
      },
    ]),
    operations: [
      {
        kind: "createEdition",
        eventId: wacken.initial.event.id,
        tempKey: "edition_2027",
        data: { editionKey: "year-2027", editionYear: 2027 },
      },
    ] as CatalogResearchResult["operations"],
    references: { edition_2027: newId },
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
            subject: wacken.initial.event.editions[0].id,
          },
        ],
      },
      forbiddenOld,
    ),
  ).toBe(true);
});

test("fixture links preserve Markdown destinations without interpreting code as links", () => {
  const links = sourceLinks(
    `## Festival 2027 tickets

[Weekend **pass**](../tickets/a_(b) "Buy"), [Another pass](../tickets/a_(b)), and [Details][info].

[info]: /info

\`[Fake](https://fake.example/)\`

[Unsafe](javascript:alert) [Private](https://user:pass@example.org/)`,
    "https://festival.example/2027/",
  );
  expect(links).toEqual([
    "https://festival.example/tickets/a_(b)",
    "https://festival.example/info",
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
      explanations: [],
      newValue: roskilde.initial.event.id,
    },
    {
      subject,
      field: "edition_key",
      oldValue: null,
      explanations: [],
      newValue: "2027",
    },
  ];
  base.push({
    subject,
    field: "edition_year",
    oldValue: null,
    explanations: [],
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
            explanations: [],
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
    explanations: [],
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
      explanations: [],
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
          explanations: [],
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
      explanations: [],
      newValue: wacken.initial.event.id,
    },
    {
      subject,
      field: "edition_key",
      oldValue: null,
      explanations: [],
      newValue: "2027",
    },
    {
      subject,
      field: "edition_year",
      oldValue: null,
      explanations: [],
      newValue: 2027,
    },
    ...wacken.expectations.required.map((assertion) => ({
      subject: assertion.owner === "event" ? wacken.initial.event.id : subject,
      field: assertion.field,
      oldValue: null,
      explanations: [],
      newValue:
        assertion.field === "links"
          ? [assertion.containsAny![0]]
          : assertion.value,
    })),
    {
      subject,
      field: "terms",
      oldValue: [],
      explanations: [],
      newValue: ["catalog:term:genre:metal"],
    },
  ]);
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.editions[0].id,
    field: "terms",
    oldValue: [],
    explanations: [],
    newValue: ["catalog:term:genre:metal"],
  });
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.editions[0].id,
    field: "starts_on",
    oldValue: "2026-07-30",
    explanations: [],
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
        explanations: [],
        newValue: wacken.initial.event.id,
      },
      {
        subject,
        field: "edition_key",
        oldValue: null,
        explanations: [],
        newValue: "2027",
      },
      {
        subject,
        field: "edition_year",
        oldValue: null,
        explanations: [],
        newValue: 2027,
      },
      {
        subject,
        field: "country_code",
        oldValue: null,
        explanations: [],
        newValue: value,
      },
    ]);
    expect(assertionMatches(wacken, output, assertion)).toBe(forbidden);
  }
});

test.each(["wacken", "roskilde", "sziget"])(
  "%s permits optional openair and structurally gated publication",
  (id) => {
    const item = byId.get(id)!;
    expect(
      item.expectations.required.some(
        (a) => a.contains === "validation:openair",
      ),
    ).toBe(false);
    expect(
      item.expectations.forbidden.some(
        (a) =>
          a.contains === "validation:openair" ||
          a.field === "publication_state",
      ),
    ).toBe(false);
  },
);

test.each(["workflow_failed", "run_persistence_failed"] as const)(
  "ordinary factual acceptance rejects %s despite successful outcomes",
  (code) => {
    const report = result();
    const item = {
      ...tomorrowland,
      expectations: { required: [], forbidden: [] },
    };
    expect(scoreCase(item, report).passed).toBe(true);
    expect(
      scoreCase(item, {
        ...report,
        errors: [{ code, stage: "workflow", message: "Host failed" }],
      }),
    ).toMatchObject({
      passed: false,
      correctness: 1,
      completeness: 1,
      research: { score: 1 },
      diagnostics: {
        execution: ["Host workflow or persistence failure"],
        correctness: [],
        completeness: [],
        research: [],
      },
    });
  },
);

test.each(["none", "workflow", "persistence"] as const)(
  "offline real eval %s retains run data and returns the correct command status",
  async (failure) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
    const failedCandidate = {
      status: "failed",
      data: null,
      errors: [
        {
          code: "source_blocked",
          message: "Official page was blocked",
          url: blocked.sources[0].attemptedUrl,
        },
      ],
      unresolved: [],
    };
    let snapshot: Record<string, unknown> | undefined;
    vi.spyOn(workflowModule, "runCatalogResearch").mockImplementation(
      async (input, deps) => {
        if (failure === "persistence") {
          deps.client.exec(
            "CREATE TRIGGER refuse_finish BEFORE UPDATE ON ingestion_runs BEGIN SELECT RAISE(ABORT, 'SECRET'); END",
          );
        }
        try {
          const report = await executeResearch(input, {
            ...deps,
            generateCandidate: async () => failedCandidate,
          });
          snapshot = deps.client
            .prepare("SELECT * FROM ingestion_runs WHERE id=?")
            .get(report.runId) as Record<string, unknown>;
          return report;
        } catch (error) {
          expect(error).toBeInstanceOf(RunPersistenceError);
          snapshot = deps.client
            .prepare("SELECT * FROM ingestion_runs WHERE id=?")
            .get((error as RunPersistenceError).runId) as Record<
            string,
            unknown
          >;
          throw error;
        }
      },
    );
    if (failure === "workflow") {
      vi.spyOn(reportModule, "buildResearchReport").mockImplementationOnce(
        () => {
          throw new Error("SECRET");
        },
      );
    }
    const reports: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
    const stdout = vi.fn();
    const code = await executeCatalogEvalCommand(["--case", blocked.id], {
      stdout,
      runEvals: async (options) => {
        // No file needed in this test; the command's default path is only metadata.
        const report = await runCatalogEvals({
          ...options,
          reportPath: undefined,
        });
        reports.push(report);
        return report;
      },
    });
    const result = reports[0].results[0];
    expect(code).toBe(failure === "none" ? 0 : 1);
    expect(result.output!.report!.runId).toBe(snapshot?.id);
    expect(result.output!.report!.modelResponse?.object).toEqual(
      failedCandidate,
    );
    expect(result.output!.report!.sources).toHaveLength(1);

    expect(JSON.stringify(result)).not.toContain("SECRET");
    if (failure !== "none") {
      expect(result.output!.score.diagnostics.execution).toEqual([
        "Host workflow or persistence failure",
      ]);
      expect(stdout.mock.calls.flat().join("")).toContain(
        "execution: Host workflow or persistence failure",
      );
      expect(
        result.output!.report!.errors.some(
          (error) =>
            error.code ===
            (failure === "workflow"
              ? "workflow_failed"
              : "run_persistence_failed"),
        ),
      ).toBe(true);
    }
    if (failure === "persistence") {
      expect(snapshot).toMatchObject({
        status: "running",
        report_json: null,
      });
    } else {
      expect(JSON.parse(snapshot!.report_json as string).runId).toBe(
        result.output!.report!.runId,
      );
    }
    expect(stdout.mock.calls.flat().join("")).toContain(
      result.output!.report!.runId,
    );
  },
);

test.each(["task", "scorer"] as const)(
  "experiment %s errors retain safe native results and close the catalog",
  async (failure) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
    let client: Parameters<typeof executeResearch>[1]["client"] | undefined;
    vi.spyOn(workflowModule, "runCatalogResearch").mockImplementation(
      async (_input, deps) => {
        client = deps.client;
        return result();
      },
    );
    if (failure === "task") {
      vi.spyOn(scoreModule, "scoreCase").mockImplementationOnce(() => {
        throw new Error("SECRET task error");
      });
    } else {
      const scorers = createEvalScorers();
      vi.spyOn(scorers.correctness, "run").mockRejectedValueOnce(
        new Error("SECRET scorer error"),
      );
      vi.spyOn(scorersModule, "createEvalScorers").mockReturnValue(scorers);
    }
    const directory = mkdtempSync(join(tmpdir(), "eventroam-eval-failure-"));
    const reportPath = join(directory, "report.json");
    try {
      const report = await runCatalogEvals({
        caseIds: [tomorrowland.id, wacken.id],
        reportPath,
      });
      expect(report.results).toHaveLength(2);
      const failed = report.results[0];
      if (failure === "task") {
        expect(failed.output).toBeNull();
        expect(failed.error).toEqual({ message: "Evaluation task failed" });
      } else {
        expect(failed.output?.report).toBeDefined();
        expect(
          failed.scores.some(
            (score) => score.error?.message === "Evaluation scorer failed",
          ),
        ).toBe(true);
      }
      expect(report.results[1].output?.report).toBeDefined();
      expect(client?.open).toBe(false);
      const stored = readFileSync(reportPath, "utf8");
      expect(stored).not.toContain("SECRET");
      expect(JSON.parse(stored).results).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("full-history eval checks unchanged raw facts independently of mutations", () => {
  const item = byId.get("scope-full-history")!;
  const raw = {
    status: "success",
    errors: [],
    unresolved: [],
    data: {
      eventId: item.initial.event.id,
      eventName: item.initial.event.canonicalName,
      sources: [],
      links: { socials: {} },
      previousEdition: { key: "historic-weekend", links: {} },
      currentOrNextEdition: { key: "announced-weekend", links: {} },
    },
  };
  const report: CatalogResearchResult = {
    ...result(),
    eventId: item.initial.event.id,
    modelResponse: { text: null, object: raw },
  };
  expect(scoreCase(item, report)).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: false,
  });
  const editions = [
    raw.data.previousEdition,
    raw.data.currentOrNextEdition,
  ].map((e) => ({
    ...e,
    ...Object.fromEntries(
      item.expectations
        .research!.facts!.filter((f) => f.editionKey === e.key)
        .map((f) => [
          f.field,
          { value: f.value, reason: "Verified on archive" },
        ]),
    ),
  }));
  const complete = {
    ...report,
    modelResponse: {
      text: null,
      object: {
        ...raw,
        data: {
          ...raw.data,
          previousEdition: editions[0],
          currentOrNextEdition: editions[1],
        },
      },
    },
  };
  expect(scoreCase(item, complete)).toMatchObject({
    passed: true,
    research: { score: 1 },
  });
  const swapped = {
    ...complete,
    modelResponse: {
      text: null,
      object: {
        ...raw,
        data: {
          ...raw.data,
          previousEdition: editions[1],
          currentOrNextEdition: editions[0],
        },
      },
    },
    editorResponse: {
      text: null,
      object: {
        status: "ready",
        event: { fields: {} },
        previousEdition: { editionKey: editions[1].key, fields: {} },
        currentOrNextEdition: { editionKey: editions[0].key, fields: {} },
        unresolved: [],
      },
    },
  };
  expect(scoreCase(item, swapped).research.score).toBeLessThan(1);
  expect(scoreCase(item, swapped).passed).toBe(false);
  const wire = {
    ...complete,
    modelResponse: {
      text: null,
      object: {
        ...raw,
        data: {
          ...raw.data,
          reason: null,
          summary: null,
          links: {
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
          previousEdition: {
            ...editions[0],
            year: null,
            displayName: null,
            links: { tickets: null },
          },
          currentOrNextEdition: {
            ...editions[1],
            year: null,
            displayName: null,
            links: { tickets: null },
          },
        },
      },
    },
  };
  expect(scoreCase(item, wire).passed).toBe(true);
  expect(
    scoreCase(item, {
      ...complete,
      modelResponse: {
        text: null,
        object: {
          status: "failed",
          data: null,
          errors: [{ code: "source_blocked", message: "blocked" }],
          unresolved: [],
        },
      },
    }).passed,
  ).toBe(false);

  expect(
    scoreCase(item, {
      ...complete,
      modelResponse: {
        text: null,
        object: {
          ...raw,
          data: {
            ...raw.data,
            previousEdition: null,
            currentOrNextEdition: editions[1],
          },
        },
      },
    }).passed,
  ).toBe(false);
});

test("unfinished-history eval requires the historical question despite no mutations", () => {
  const item = byId.get("scope-full-unfinished-history")!;
  const dates = item.expectations.research!.facts![0].value;
  const report: CatalogResearchResult = {
    ...result(),
    researchStatus: "partial",
    eventId: item.initial.event.id,
    unresolved: [{ message: "Ticket details unavailable" }],
    modelResponse: {
      text: null,
      object: {
        status: "partial",
        errors: [],
        unresolved: [{ message: "Ticket details unavailable" }],
        data: {
          eventId: item.initial.event.id,
          eventName: item.initial.event.canonicalName,
          sources: [],
          links: { socials: {} },
          previousEdition: null,
          currentOrNextEdition: {
            key: "announced-weekend",
            dates: { value: dates, reason: "Announcement" },
            links: {},
          },
        },
      },
    },
  };
  expect(scoreCase(item, report).passed).toBe(false);
  expect(
    scoreCase(item, {
      ...report,
      unresolved: [
        {
          editionKey: "historic-weekend",
          message: "Historical archive was blocked",
        },
      ],
    }).passed,
  ).toBe(true);
});

test("scope fixtures retain local time zones in temporary catalog context", () => {
  const item = byId.get("scope-current-local-day")!;
  const connection = seedDatabase(suite, item);
  try {
    expect(
      readResearchCatalog(connection.client)[0].editions.find(
        (e) => e.editionKey === "local-weekend",
      )?.timeZone,
    ).toBe("Pacific/Kiritimati");
  } finally {
    connection.client.close();
  }
});

test("size evidence eval rejects unsupported replacements and clearing", () => {
  for (const [caseId, editionKey] of [
    ["size-evidence", "repeat-admissions"],
    ["size-historical-and-unknown", "unknown"],
  ]) {
    const item = byId.get(caseId)!;
    const subject = item.initial.event.editions.find(
      (e) => e.editionKey === editionKey,
    )!.id;
    for (const newValue of [null, 20000, 24000, 8000]) {
      const changed = {
        ...result(),
        changes: [
          {
            subject,
            field: "size_estimate",
            oldValue: 6000,
            newValue,
            explanations: ["Unsupported size change"],
          },
        ],
      };
      expect(
        item.expectations.forbidden.some((assertion) =>
          assertionMatches(item, changed, assertion),
        ),
      ).toBe(true);
    }
  }
  expect(
    byId
      .get("size-evidence")!
      .expectations.forbidden.some((assertion) =>
        assertionMatches(byId.get("size-evidence")!, result(), assertion),
      ),
  ).toBe(false);
});

test.each(["toolUse", "research"] as const)(
  "eval consumers share one score per repetition for a %s-only failure",
  async (dimension) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
    const item = byId.get("search-no-announcement")!;
    const scoring = vi.spyOn(scoreModule, "scoreCase");
    let invocation = 0;
    let releaseFirst!: () => void;
    const secondFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const completionOrder: number[] = [];
    vi.spyOn(workflowModule, "runCatalogResearch").mockImplementation(
      async (_input, deps) => {
        const fail = ++invocation === 2;
        const budget = createResearchBudget();
        await deps!.readPage!(item.sources[0].attemptedUrl, { budget });
        if (fail && dimension === "toolUse") {
          await deps!.searchWeb!("Harbor Echo next announcement", {
            budget,
            config: deps!.config!,
          });
        }
        if (!fail) {
          await secondFinished;
        }
        completionOrder.push(fail ? 2 : 1);
        if (fail) {
          releaseFirst();
        }
        return {
          ...result(),
          modelResponse: {
            text: null,
            object: {
              status: "success",
              data: {
                eventName: "Harbor Echo",
                links: { socials: {} },
                sources: [],
                previousEdition:
                  fail && dimension === "research"
                    ? null
                    : { key: "2026", links: {} },
                currentOrNextEdition: null,
              },
              errors: [],
              unresolved: [],
            },
          },
        };
      },
    );
    const directory = mkdtempSync(
      join(tmpdir(), "eventroam-eval-diagnostics-"),
    );
    const reportPath = join(directory, "report.json");
    const reports: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
    const stdout = vi.fn();
    try {
      const code = await executeCatalogEvalCommand(
        ["--case", item.id, "--repeat", "2", "--report", reportPath],
        {
          stdout,
          runEvals: async (options) => {
            const report = await runCatalogEvals(options);
            reports.push(report);
            return report;
          },
        },
      );
      expect(code).toBe(1);
      expect(completionOrder).toEqual([2, 1]);
      const report = reports[0];
      expect(report.experiment).toMatchObject({
        status: "completed",
        totalItems: 2,
        succeededCount: 2,
        failedCount: 0,
      });
      expect(report.results.map((entry) => entry.repetition)).toEqual([1, 2]);
      expect(report.results.map((entry) => entry.output!.score.passed)).toEqual(
        [true, false],
      );
      expect(
        report.results.every(
          (entry) =>
            entry.output!.score.correctness === 1 &&
            entry.output!.score.completeness === 1,
        ),
      ).toBe(true);
      const diagnostic =
        dimension === "toolUse" ? "searches <= 0" : "previousEdition=2026";
      expect(
        report.results.map(
          (entry) => entry.output!.score.diagnostics[dimension],
        ),
      ).toEqual([[], [diagnostic]]);
      expect(
        report.results.map((entry) =>
          entry.output!.toolCalls.map((call) => call.tool),
        ),
      ).toEqual([
        ["readPage"],
        dimension === "toolUse" ? ["readPage", "searchWeb"] : ["readPage"],
      ]);
      const stored = JSON.parse(readFileSync(reportPath, "utf8"));
      expect(
        stored.results.map(
          (entry: { output: { score: unknown } }) => entry.output!.score,
        ),
      ).toEqual(report.results.map((entry) => entry.output!.score));
      const text = stdout.mock.calls.flat().join("");
      expect(text).toContain("1/2 cases passed");
      expect(text).toContain(`  ${dimension}: ${diagnostic}\n`);
      expect(text.indexOf(diagnostic)).toBeGreaterThan(
        text.indexOf(`${item.id} #2:`),
      );
      const scorerId =
        dimension === "toolUse"
          ? "source-search-policy"
          : "research-completeness";
      expect(
        report.results.map((entry) =>
          entry.scores.find((scorer) => scorer.scorerId === scorerId),
        ),
      ).toEqual([
        expect.objectContaining({ score: 1, error: undefined }),
        expect.objectContaining({
          score: dimension === "toolUse" ? 0 : 2 / 3,
          reason: diagnostic,
          error: undefined,
        }),
      ]);
      expect(stored.experiment).toEqual(
        JSON.parse(JSON.stringify(report.experiment)),
      );
      expect(
        stored.results.map((entry: { scores: unknown }) => entry.scores),
      ).toEqual(report.results.map((entry) => entry.scores));
      expect(scoring).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test.each([
  ["2027-01-23", "2027-01-30", true],
  ["2027-02-01", "2027-02-03", false],
])(
  "date-conflict eval requires resolved dates %s–%s",
  (startsOn, endsOn, passed) => {
    const item = byId.get("search-date-conflict")!;
    const report: CatalogResearchResult = {
      ...result(),
      eventId: item.initial.event.id,
      modelResponse: {
        text: null,
        object: {
          status: "success",
          errors: [],
          unresolved: [],
          data: {
            eventId: item.initial.event.id,
            eventName: item.initial.event.canonicalName,
            sources: [],
            links: { socials: {} },
            previousEdition: null,
            currentOrNextEdition: {
              key: "2027",
              links: {},
              dates: {
                value: { startsOn, endsOn, state: "confirmed" },
                reason: "Checked the independent venue announcement",
              },
            },
          },
        },
      },
    };
    const score = scoreCase(item, report, [
      { tool: "searchWeb", query: "Harbor Echo 2027 dates" },
      { tool: "readPage", url: item.sources[1].finalUrl },
    ]);
    expect(score.toolUse?.score).toBe(1);
    expect(score.passed).toBe(passed);
    expect(
      score.research?.checks.find(
        (check) => check.description === "returned 2027.dates",
      )?.matched,
    ).toBe(passed);
  },
);

test.each([
  undefined,
  null,
  { value: null, reason: "Disproven" },
  { value: "Unwanted Event finding", reason: "Source" },
])(
  "raw absent-field scoring rejects findings even without writes (%j)",
  (summary) => {
    const item = structuredClone(byId.get("scope-current-ongoing")!);
    item.expectations.research = {
      status: "success",
      absentFields: [{ field: "summary" }, { field: "links.website" }],
    };
    const raw = {
      status: "success",
      errors: [],
      unresolved: [],
      data: {
        eventName: item.initial.event.canonicalName,
        sources: [],
        links: { socials: {}, website: null },
        previousEdition: null,
        currentOrNextEdition: null,
        summary,
      },
    };
    const report = {
      ...result(),
      eventId: item.initial.event.id,
      modelResponse: { text: null, object: raw },
    };
    const score = scoreCase(item, report);
    expect(score.correctness).toBe(1);
    expect(score.completeness).toBe(1);
    expect(score.passed).toBe(summary == null);
    Object.assign(raw.data.links, { website: "https://unwanted.example/" });
    expect(scoreCase(item, report).passed).toBe(false);
  },
);

test("absent-field scoring requires a valid candidate and the addressed Edition", () => {
  const item = structuredClone(byId.get("scope-current-ongoing")!);
  item.expectations.research = {
    status: "success",
    absentFields: [{ editionKey: "missing", field: "tickets" }],
  };
  expect(scoreCase(item, result()).passed).toBe(false);
  const raw = {
    status: "success",
    errors: [],
    unresolved: [],
    data: {
      eventName: "River Festival",
      sources: [],
      links: { socials: {} },
      previousEdition: null,
      currentOrNextEdition: null,
    },
  };
  expect(
    scoreCase(item, { ...result(), modelResponse: { text: null, object: raw } })
      .passed,
  ).toBe(false);
});

test.each(suite.cases.filter((item) => item.id.startsWith("narrow-current-")))(
  "$id has a valid complete baseline and rejects missing mandatory updates",
  (item) => {
    const db = seedDatabase(suite, item);
    try {
      expect(readResearchCatalog(db.client)).toHaveLength(1);
      const score = scoreCase(item, result());
      expect(score.research?.score).toBeLessThan(1);
      if (item.expectations.required.length) {
        expect(score.required).toEqual(
          item.expectations.required.map((assertion) => ({
            assertion,
            matched: false,
          })),
        );
      }
      expect(item.expectations.research?.absentFields).toContainEqual({
        field: "summary",
      });
    } finally {
      db.client.close();
    }
  },
);

test("new-Edition scoring accepts a distinct key and rejects the historical donor key", () => {
  const item = byId.get("narrow-current-noncomparable")!;
  const facts = item.expectations.research!.facts!;
  const report = result();
  const edition = {
    key: "spring-2027",
    year: { value: 2027, reason: "New annual announcement" },
    dates: {
      value: {
        startsOn: "2027-06-04",
        endsOn: "2027-06-05",
        state: "confirmed",
      },
      reason: "Confirmed dates",
    },
    classification: {
      value: facts
        .filter((f) => f.field === "classification")
        .map((f) => f.value),
      reason: "Continuity with spring-2026",
    },
    links: {},
  };
  report.modelResponse = {
    text: "",
    object: {
      status: "success",
      errors: [],
      unresolved: [],
      data: {
        eventName: item.initial.event.canonicalName,
        sources: [
          {
            url: item.sources[0].finalUrl,
            information: "Official announcement",
          },
        ],
        links: { socials: {} },
        previousEdition: null,
        currentOrNextEdition: edition,
      },
    },
  };
  expect(scoreCase(item, report).research?.score).toBe(1);
  edition.key = "spring-2026";
  expect(scoreCase(item, report).research?.score).toBeLessThan(1);
  edition.key = "spring-2027";
  edition.dates.value.startsOn = "2027-07-04";
  expect(scoreCase(item, report).research?.score).toBeLessThan(1);
});

test("no-target scoring rejects incidental publication writes", () => {
  const item = byId.get("narrow-current-none")!;
  const report = result();
  report.modelResponse = {
    text: "",
    object: {
      status: "success",
      errors: [],
      unresolved: [],
      data: {
        eventName: item.initial.event.canonicalName,
        sources: [
          {
            url: item.sources[0].finalUrl,
            information: "No upcoming announcement",
          },
        ],
        links: { socials: {} },
        previousEdition: null,
        currentOrNextEdition: null,
      },
    },
  };
  expect(scoreCase(item, report).passed).toBe(true);
  report.changes.push({
    subject: item.initial.event.editions[0].id,
    field: "publication_state",
    oldValue: "draft",
    newValue: "published",
    explanations: [],
  });
  expect(scoreCase(item, report).passed).toBe(false);
});

test("current identity-conflict eval requires a diagnosed stop without recovery or editing", () => {
  const item = byId.get("current-identity-contradiction")!;
  const question = {
    field: "identity",
    message:
      "Saved site is an Australian namesake, not this UK festival; run full.",
  };
  const failed: CatalogResearchResult = {
    ...result(),
    outcome: "failed",
    researchStatus: "failed",
    editorStatus: "not_run",
    modelResponse: {
      text: null,
      object: {
        status: "failed",
        data: null,
        errors: [],
        unresolved: [question],
      },
    },
    unresolved: [question],
    sources: [
      {
        attemptedUrl: item.sources[0].attemptedUrl,
        finalUrl: item.sources[0].finalUrl,
        retrievedAt: item.sources[0].retrievedAt,
        outcome: "ok",
      },
    ],
  };
  expect(scoreCase(item, failed).passed).toBe(true);
  for (const invalid of [
    { ...failed, unresolved: [] },
    { ...failed, budget: { ...failed.budget, searches: 1 } },
    { ...failed, unresolved: [{ message: "No prices found" }] },
    { ...failed, editorStatus: "success" as const },
    {
      ...failed,
      sources: [
        ...failed.sources,
        {
          ...failed.sources[0],
          attemptedUrl: "https://harbor-echo-uk.example/",
        },
      ],
    },
    {
      ...failed,
      errors: [
        {
          code: "model_failed" as const,
          stage: "research" as const,
          message: "Provider error",
        },
      ],
    },
    { ...failed, modelResponse: null },
  ]) {
    const score = scoreCase(item, invalid);
    expect(score.passed).toBe(false);
    expect(score.diagnostics.research.length).toBeGreaterThan(0);
  }
  expect(
    scoreCase(item, { ...failed, budget: { ...failed.budget, searches: 1 } })
      .diagnostics.research,
  ).toEqual(["Expected identity conflict to stop without search"]);
});

test("Tomorrowland permits partial preservation when its destination is unavailable", () => {
  const unresolved = [
    {
      message: "Belgium destination is unavailable; preserve unverified facts.",
    },
  ];
  const partial = {
    ...result(),
    researchStatus: "partial" as const,
    unresolved,
    modelResponse: {
      text: null,
      object: {
        status: "partial",
        data: {
          eventName: "Tomorrowland",
          links: { socials: {} },
          sources: [
            {
              url: "https://www.tomorrowland.com/",
              information:
                "Official portal links to the unavailable Belgium site.",
            },
          ],
          previousEdition: null,
          currentOrNextEdition: null,
        },
        errors: [],
        unresolved,
      },
    },
  };
  expect(scoreCase(tomorrowland, partial).passed).toBe(true);
  expect(
    scoreCase(tomorrowland, { ...partial, outcome: "failed" }).passed,
  ).toBe(false);
});

test("mutation matcher preserves partial object matching and null exclusions", () => {
  const assertion = {
    owner: "event" as const,
    field: "summary",
    notValue: "saved",
  };
  const changed = (newValue: unknown) =>
    result([
      {
        subject: tomorrowland.initial.event.id,
        field: "summary",
        oldValue: "saved",
        newValue,
        explanations: [],
      },
    ]);
  expect(assertionMatches(tomorrowland, changed(null), assertion)).toBe(false);
  expect(assertionMatches(tomorrowland, changed("wrong"), assertion)).toBe(
    true,
  );
  expect(
    assertionMatches(tomorrowland, changed(null), {
      owner: "event",
      field: "summary",
      value: null,
    }),
  ).toBe(true);
  expect(
    assertionMatches(
      tomorrowland,
      changed({ nested: { value: 1, extra: 2 } }),
      {
        owner: "event",
        field: "summary",
        value: { nested: { value: 1 } },
      },
    ),
  ).toBe(true);
});
