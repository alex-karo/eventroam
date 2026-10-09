import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { runEvals } from "@mastra/core/evals";
import { Mastra } from "@mastra/core/mastra";
import { noopLogger } from "@mastra/core/logger";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
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
import { assertionMatches, createEvalScorers, scoreCase } from "./score";

const suite = loadEvalSuite();
const byId = new Map(suite.cases.map((item) => [item.id, item]));
const tomorrowland = byId.get("tomorrowland")!;
const wacken = byId.get("wacken")!;
const blocked = byId.get("afro-nation-portugal-blocked")!;

test("empty change assertions are reserved for failed research cases", () => {
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
        required: tomorrowland.expectations.required,
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
  const read = await fixedSources(blocked, blocked.todayUtc!).readSource(
    source.attemptedUrl,
    { budget: createResearchBudget() } as Parameters<
      ReturnType<typeof fixedSources>["readSource"]
    >[1],
  );
  expect(read).toMatchObject({ outcome: "blocked", reason: "http_403" });
});

test("failed-source eval requires null data, source diagnosis, and no writes", () => {
  const sourceUrl = blocked.sources[0].attemptedUrl;
  const sourceError = {
    code: "source_blocked" as const,
    stage: "source" as const,
    message: "Official ticket page returned HTTP 403",
    url: sourceUrl,
  };
  const expected: CatalogResearchResult = {
    ...result(),
    mode: "check",
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
  expect(Number.isNaN(scoreCase(blocked, expected).correctness)).toBe(false);
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
    expect(scoreCase(blocked, invalid).passed).toBe(false);
  }
});

test("eval fixtures reject the old schema version", () => {
  expect(suite.schemaVersion).toBe(2);
  expect(
    evalSuiteSchema.safeParse({ ...suite, schemaVersion: 1 }).success,
  ).toBe(false);
});

test("eval scorer rejects unsupported result report versions", () => {
  expect(() =>
    scoreCase(tomorrowland, {
      ...result(),
      schemaVersion: 1,
    } as unknown as CatalogResearchResult),
  ).toThrow("Unsupported catalog report version: 1");
  const missing = { ...result() } as Partial<CatalogResearchResult>;
  delete missing.schemaVersion;
  expect(() =>
    scoreCase(tomorrowland, missing as CatalogResearchResult),
  ).toThrow("Unsupported catalog report version: undefined");
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
  expect(scoreCase(tomorrowland, partial).passed).toBe(true);
  const failed = scoreCase(tomorrowland, {
    ...partial,
    researchStatus: "failed",
  });
  expect(failed).toMatchObject({
    correctness: 0,
    completeness: 0,
    passed: false,
  });
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
    if (
      change.field === "occurrence_key" &&
      typeof change.newValue === "string"
    ) {
      facts.key = change.newValue;
    }
    if (
      change.field === "occurrence_year" &&
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
    schemaVersion: 2,
    mode: "refresh",
    outcome: changes.length ? "updated" : "unchanged",
    modelResponse: null,
    researchStatus: "success",
    eventId: tomorrowland.initial.event.id,
    operations: newEditions.map(([subject, facts]) => ({
      kind: "createOccurrence",
      eventId: facts.eventId!,
      tempKey: subject,
      data: {
        occurrenceKey: facts.key!,
        ...(facts.year === undefined ? {} : { occurrenceYear: facts.year }),
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
    usage: {
      ...createResearchBudget().snapshot(),
      complete: true,
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
    expect(known.links).toContain("https://winter.tomorrowland.com/");
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
    explanations: [],
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

test("Tomorrowland rejects Thailand sell-out on a Belgium ticket variant", () => {
  const official = {
    subject: tomorrowland.initial.event.id,
    field: "links",
    oldValue: [],
    explanations: [],
    newValue: [{ kind: "official_site", url: "https://www.tomorrowland.com/" }],
  };
  const soldOut = {
    subject: tomorrowland.initial.event.occurrences[0].id,
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
  expect(scoreCase(tomorrowland, result([official]))).toMatchObject({
    correctness: 1,
    completeness: 1,
    passed: true,
  });
  const score = scoreCase(tomorrowland, result([official, soldOut]));
  expect(score.completeness).toBe(1);
  expect(score.correctness).toBeLessThan(1);
  expect(score.passed).toBe(false);
  expect(score.reasons.violatedForbidden).toEqual([
    expect.objectContaining({
      owner: "occurrence",
      field: "price_details",
      contains: { availability: "sold_out" },
    }),
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
          explanations: [],
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
      field: "occurrence_key",
      oldValue: null,
      explanations: [],
      newValue: "2027",
    },
  ];
  base.push({
    subject,
    field: "occurrence_year",
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
      field: "occurrence_key",
      oldValue: null,
      explanations: [],
      newValue: "2027",
    },
    {
      subject,
      field: "occurrence_year",
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
      newValue: ["festivalnetwork:term:genre:metal"],
    },
  ]);
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.occurrences[0].id,
    field: "terms",
    oldValue: [],
    explanations: [],
    newValue: ["festivalnetwork:term:genre:metal"],
  });
  expect(scoreCase(wacken, output).passed).toBe(true);
  output.changes.push({
    subject: wacken.initial.event.occurrences[0].id,
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
        field: "occurrence_key",
        oldValue: null,
        explanations: [],
        newValue: "2027",
      },
      {
        subject,
        field: "occurrence_year",
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

test.each(["workflow_failed", "run_persistence_failed"] as const)(
  "ordinary factual acceptance rejects %s despite successful outcomes",
  (code) => {
    const report = result();
    const item = {
      ...tomorrowland,
      expectations: { required: [], forbidden: [] },
    };
    expect(scoreCase(item, report).passed).toBe(true); // historical version 2, additive fields absent
    expect(
      scoreCase(item, {
        ...report,
        errors: [{ code, stage: "workflow", message: "Host failed" }],
      }),
    ).toMatchObject({
      passed: false,
      correctness: 0,
      completeness: 0,
      reasons: { workflowFailed: true },
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
    expect(result.runId).toBe(snapshot?.id);
    expect(result.modelResponse?.object).toEqual(failedCandidate);
    expect(result.sources).toHaveLength(1);
    expect(result.usage.searchCostBasis).toBe("estimate");
    expect(JSON.stringify(result)).not.toContain("SECRET");
    if (failure !== "none") {
      expect(
        result.errors.some(
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
        input_tokens: null,
      });
    } else {
      expect(JSON.parse(snapshot!.report_json as string).runId).toBe(
        result.runId,
      );
    }
    expect(stdout.mock.calls.flat().join("")).toContain(result.runId);
  },
);

test("effective-state ticket assertions catch preservation and no-op values missed by diffs", () => {
  const item = structuredClone(tomorrowland);
  const edition = item.initial.event.occurrences[0];
  edition.tickets = {
    variants: [{ label: "Saved weekend", amount: 100, currency: "EUR" }],
    basePrice: {
      kind: "exact",
      currency: "EUR",
      minAmount: 100,
      maxAmount: 100,
      coverage: "full_programme",
    },
  };
  const report = result();
  const assertion = {
    owner: "occurrence" as const,
    editionKey: edition.occurrenceKey,
    field: "price_min_minor",
    value: 10000,
    state: "effective" as const,
  };
  expect(assertionMatches(item, report, assertion)).toBe(true);
  expect(
    assertionMatches(item, report, { ...assertion, state: undefined }),
  ).toBe(false);
  report.changes.push({
    subject: edition.id,
    field: "price_min_minor",
    oldValue: 10000,
    newValue: 12300,
    explanations: ["Verified price"],
  });
  expect(assertionMatches(item, report, assertion)).toBe(false);
  expect(assertionMatches(item, report, { ...assertion, value: 12300 })).toBe(
    true,
  );
});
