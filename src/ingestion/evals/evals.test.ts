import { evalReport } from "@/test/eval-report";
import {
  generateFixtureEditor,
  generateFixtureLocation,
} from "@/test/ingestion";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../runtime/budget";
import type { CatalogResearchResult } from "../workflow";
import * as workflowModule from "../workflow";
import * as reportModule from "../report";
import { RunPersistenceError } from "../runs";
import { executeCatalogEvalCommand } from "../../../commands/catalog-eval";
const executeResearch = workflowModule.runCatalogResearch;
let evalDirectory: string;
beforeEach(() => {
  evalDirectory = mkdtempSync(join(tmpdir(), "eventroam-evals-test-"));
  vi.stubEnv("CATALOG_EVAL_DATABASE_PATH", join(evalDirectory, "evals.sqlite"));
});
afterEach(() => {
  rmSync(evalDirectory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
import {
  loadEvalSuite,
  evalCaseSchema,
  evalSuiteSchema,
  type RegressionPipelineEvalCase,
} from "./fixtures";
import { sourceLinks } from "./source-links";
import { fixedSources, runCatalogEvals, seedDatabase } from "./run";
import { assertionMatches } from "./assertions";
import { createEvalScorers } from "./scorers";
import { scoreCase } from "./score";
import { scoreResearch } from "./research-score";
import { evaluateMainCase } from "./main";
import * as scoreModule from "./score";
import * as scorersModule from "./scorers";
import { readSavedResults } from "@/test/eval-storage";

const suite = loadEvalSuite();
const byId = new Map(
  suite.cases
    .filter(
      (item): item is RegressionPipelineEvalCase =>
        !item.location && item.suite === "regression",
    )
    .map((item) => [item.id, item]),
);
const mainById = new Map(
  suite.cases
    .filter((item) => !item.location && item.suite === "main")
    .map((item) => [item.id, item]),
);
const wacken = mainById.get("wacken")!;
const blocked = mainById.get("afro-nation-portugal-blocked")!;
test("editor-only rejects cases without handoffs before provider setup", async () => {
  await expect(
    runCatalogEvals({ editorOnly: true, caseIds: [wacken.id] }),
  ).rejects.toThrow("Unknown or incompatible");
});

test("explicit mixed cases select their own groups without a mode flag", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  await expect(
    runCatalogEvals({ caseIds: ["wacken", "editor-clear"] }),
  ).rejects.toThrow("OPENROUTER_API_KEY is required");
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
        });
        reports.push(report);
        return report;
      },
    });
    expect(code).toBe(0);
    expect(execute).toHaveBeenCalledTimes(7);
    expect(fetch).not.toHaveBeenCalled();
    const report = reports[0];
    expect(report.groups[0].group).toBe("regression/editor");
    expect(
      report.groups[0].results.every((item) => item.output!.score!.passed),
    ).toBe(true);
    for (const row of report.groups[0].results) {
      const handoff = byId.get(row.caseId)!.researchHandoff!;
      expect(row.output!.report!.modelResponse?.object).toEqual(
        handoff.candidate,
      );
      expect(
        (row.input as { fixture: { researchHandoff: unknown } }).fixture
          .researchHandoff,
      ).toEqual(handoff);
    }
  } finally {
    vi.unstubAllGlobals();
  }
}, 15_000);

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

test("pipeline fixtures require seed data, sources and explicit expectations", () => {
  expect(blocked.provenance?.kind).toBe(
    "captured-http-metadata-synthetic-replay",
  );
  expect(blocked.todayUtc).toBe("2026-10-08");
  for (const field of ["initial", "sources"]) {
    expect(
      evalCaseSchema.safeParse({ ...wacken, [field]: undefined }).success,
    ).toBe(false);
  }
  expect(
    evalCaseSchema.safeParse({
      ...byId.get("search-no-announcement")!,
      expectations: { required: [], forbidden: [] },
    }).success,
  ).toBe(false);
  expect(
    evalCaseSchema.safeParse({
      ...blocked,
      expectations: {
        ...blocked.expectations,
        required: [{ owner: "event", field: "links" }],
      },
    }).success,
  ).toBe(false);
});

test("main fixtures reject mutation assertions and regressions still require them", () => {
  for (const item of mainById.values()) {
    expect(item.expectations).not.toHaveProperty("required");
    expect(item.expectations).not.toHaveProperty("forbidden");
    for (const field of ["required", "forbidden"]) {
      expect(
        evalCaseSchema.safeParse({
          ...item,
          expectations: { ...item.expectations, [field]: [] },
        }).success,
      ).toBe(false);
    }
  }
  const item = byId.get("search-no-announcement")!;
  for (const field of ["required", "forbidden"]) {
    expect(
      evalCaseSchema.safeParse({
        ...item,
        expectations: { ...item.expectations, [field]: undefined },
      }).success,
    ).toBe(false);
  }
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
  const db = seedDatabase(suite, blocked);
  const catalog = readResearchCatalog(db.client);
  db.client.close();
  const score = (report: CatalogResearchResult) =>
    evaluateMainCase(blocked, catalog, catalog, report);
  const sourceUrl = blocked.sources[0].attemptedUrl;
  const sourceError = {
    code: "source_blocked" as const,
    stage: "source" as const,
    message: "Official ticket page returned HTTP 403",
    url: sourceUrl,
  };
  const unresolved = [{ message: "Official source access is blocked" }];
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
        unresolved,
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
    unresolved,
  };
  expect(score(expected)).toMatchObject({ errorCount: 0, passed: true });
  expect(score(expected).conditions.filter((check) => !check.passed)).toEqual(
    [],
  );
  const changed = score({
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
  });
  expect(changed.passed).toBe(false);
  expect(changed.conditions).toContainEqual(
    expect.objectContaining({
      path: "research",
      passed: false,
      message: "Expected no catalog changes",
    }),
  );
  const missingDiagnosis = score({ ...expected, errors: [] });
  expect(missingDiagnosis.passed).toBe(false);
  expect(missingDiagnosis.conditions).toContainEqual(
    expect.objectContaining({
      path: "research",
      passed: false,
      message:
        "Expected a source-failure diagnosis for an unavailable inspected URL",
    }),
  );
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
    const invalidScore = score(invalid);
    expect(invalidScore.passed).toBe(false);
    expect(
      invalidScore.conditions.some(
        (check) =>
          !check.passed && ["research", "execution"].includes(check.path),
      ),
    ).toBe(true);
  }
});

test("eval fixtures reject the old schema version", () => {
  expect(suite.schemaVersion).toBe(2);
  expect(
    evalSuiteSchema.safeParse({ ...suite, schemaVersion: 1 }).success,
  ).toBe(false);
});

test("the eval command rejects the removed report option before setup", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  await expect(
    executeCatalogEvalCommand(["--report", "unused.json"]),
  ).rejects.toThrow("Unknown eval option: --report");
});

function result(changes: CatalogResearchResult["changes"] = []) {
  return evalReport(changes, wacken.initial.event.id);
}

test("fixed source adapter uses captured pages and blocks unknown URLs without network", async () => {
  const connection = seedDatabase(suite, {
    ...wacken,
    initial: {
      ...wacken.initial,
      relatedEvents: [
        {
          ...wacken.initial.event,
          id: "other-event",
          slug: "other-event",
          canonicalName: "Other festival",
          editions: [],
        },
      ],
    },
  });
  try {
    const catalog = readResearchCatalog(connection.client);
    expect(catalog.map((event) => event.canonicalName)).toContain(
      "Other festival",
    );
    expect(
      catalog.find((event) => event.id === wacken.initial.event.id)?.editions,
    ).toHaveLength(1);
    const sources = fixedSources(wacken, suite.todayUtc);
    const budget = createResearchBudget();
    const known = await sources.readPage(wacken.sources[0].attemptedUrl, {
      budget,
    });
    expect(known.markdown).toEqual(wacken.sources[0].markdown);
    expect(wacken.sources[0]).not.toHaveProperty("links");
    expect(
      evalCaseSchema.safeParse({
        ...wacken,
        sources: [{ ...wacken.sources[0], links: [] }],
      }).success,
    ).toBe(false);
    expect(known.links).toContain("https://www.wacken.com/de/");
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

test.each(["workflow_failed", "run_persistence_failed"] as const)(
  "ordinary factual acceptance rejects %s despite successful outcomes",
  (code) => {
    const report = result();
    const item = {
      ...byId.get("search-no-announcement")!,
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
      unresolved: [{ message: "Official source is blocked" }],
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
        const report = await runCatalogEvals({
          ...options,
        });
        reports.push(report);
        return report;
      },
    });
    const result = reports[0].groups[0].results[0];
    expect(code).toBe(failure === "none" ? 0 : 1);
    expect(result.output!.report!.runId).toBe(snapshot?.id);
    expect(result.output!.report!.modelResponse?.object).toEqual(
      failedCandidate,
    );
    expect(result.output!.report!.sources).toHaveLength(1);

    expect(JSON.stringify(result)).not.toContain("SECRET");
    if (failure !== "none") {
      expect(result.output!.quality!.conditions).toContainEqual({
        path: "execution",
        passed: false,
        message: "Host workflow or run persistence failed",
      });
      expect(stdout.mock.calls.flat().join("")).toContain(
        "Host workflow or run persistence failed",
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
      vi.spyOn(scorers.scenario, "run").mockRejectedValueOnce(
        new Error("Injected scorer failure"),
      );
      vi.spyOn(scorersModule, "createEvalScorers").mockReturnValue(scorers);
    }
    const report = await runCatalogEvals({
      caseIds: ["scope-current-stable-key", "search-no-announcement"],
    });
    expect(report.groups[0].results).toHaveLength(2);
    const failed = report.groups[0].results.find((item) =>
      failure === "task"
        ? !!item.error
        : item.scores.some((score) => score.error),
    )!;
    if (failure === "task") {
      expect(failed.output).toBeNull();
      expect(failed.error).toMatchObject({
        message: "Evaluation task failed",
      });
    } else {
      expect(failed.output?.report).toBeDefined();
      expect(failed.scores.some((score) => !!score.error)).toBe(true);
    }
    expect(
      report.groups[0].results.find((item) => item.itemId !== failed.itemId)!
        .output?.report,
    ).toBeDefined();
    expect(client?.open).toBe(false);
    const stored = await readSavedResults(report.groups[0]);
    expect(JSON.stringify(stored)).not.toContain("SECRET");
    expect(stored.results).toHaveLength(2);
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
    const reports: Awaited<ReturnType<typeof runCatalogEvals>>[] = [];
    const stdout = vi.fn();
    const code = await executeCatalogEvalCommand(
      ["--case", item.id, "--repeat", "2"],
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
    expect(report.groups[0]).toMatchObject({
      status: "completed",
      totalItems: 2,
      succeededCount: 2,
      failedCount: 0,
    });
    expect(report.groups[0].results.map((entry) => entry.repetition)).toEqual([
      1, 2,
    ]);
    const results = [...report.groups[0].results].sort(
      (a, b) =>
        Number(b.output!.score!.passed) - Number(a.output!.score!.passed),
    );
    expect(results.map((entry) => entry.output!.score!.passed)).toEqual([
      true,
      false,
    ]);
    expect(
      report.groups[0].results.every(
        (entry) =>
          entry.output!.score!.correctness === 1 &&
          entry.output!.score!.completeness === 1,
      ),
    ).toBe(true);
    const diagnostic =
      dimension === "toolUse" ? "searches <= 0" : "previousEdition=2026";
    expect(
      results.map((entry) => entry.output!.score!.diagnostics[dimension]),
    ).toEqual([[], [diagnostic]]);
    expect(
      results.map((entry) => entry.output!.toolCalls.map((call) => call.tool)),
    ).toEqual([
      ["readPage"],
      dimension === "toolUse" ? ["readPage", "searchWeb"] : ["readPage"],
    ]);
    const stored = await readSavedResults(report.groups[0]);
    expect(
      stored.results.map((entry) => JSON.stringify(entry.output)).sort(),
    ).toEqual(
      report.groups[0].results
        .map((entry) => JSON.stringify(entry.output))
        .sort(),
    );
    const text = stdout.mock.calls.flat().join("");
    expect(text).toContain("1/2 passed");
    expect(text).toContain(`  ${dimension}: ${diagnostic}\n`);
    expect(text.indexOf(diagnostic)).toBeGreaterThan(
      text.indexOf(`${item.id} #${results[1].repetition}:`),
    );
    expect(
      results.map((entry) =>
        entry.scores.find((scorer) => scorer.scorerId === "scenario-success"),
      ),
    ).toEqual([
      expect.objectContaining({ score: 1, error: null }),
      expect.objectContaining({ score: 0, reason: diagnostic, error: null }),
    ]);
    expect(stored.scores.map((score) => score.score).sort()).toEqual([0, 1]);
    expect(scoring).toHaveBeenCalledTimes(2);
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

test.each(
  [...byId.values()].filter((item) => item.id.startsWith("narrow-current-")),
)(
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

test("partial research can preserve data when a source is unavailable", () => {
  const unresolved = [
    {
      message: "Official source is unavailable; preserve unverified facts.",
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
          eventName: "Wacken Open Air",
          links: { socials: {} },
          sources: [
            {
              url: "https://www.wacken.com/",
              information: "Official portal links to an unavailable source.",
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
  expect(
    scoreResearch(
      {
        ...wacken,
        expectations: { research: { status: "partial", hasUnresolved: true } },
      },
      partial,
    ).score,
  ).toBe(1);
  expect(
    scoreResearch(
      {
        ...wacken,
        expectations: { research: { status: "partial", hasUnresolved: true } },
      },
      { ...partial, outcome: "failed" },
    ).score,
  ).toBeLessThan(1);
});
