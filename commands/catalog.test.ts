import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import type {
  CatalogResearchResult,
  runCatalogResearch,
} from "@/ingestion/workflow";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import * as reportModule from "@/ingestion/report";
import { RunPersistenceError } from "@/ingestion/runs";
afterEach(() => vi.restoreAllMocks());
import { executeCatalogCommand, formatCatalogReport } from "./catalog";

const result = (): CatalogResearchResult => ({
  schemaVersion: 2,
  mode: "check",
  outcome: "unchanged",
  modelResponse: null,
  researchStatus: "success",
  operations: [],
  receipts: [],
  references: {},
  changes: [],
  sources: [],
  sourceSummaries: [],
  errors: [],
  unresolved: [],
  eventNameMismatch: null,
  usage: {
    complete: true,
    searches: 0,
    pages: 0,
    modelCalls: 0,
    elapsedMs: 0,
    remaining: {
      searches: 3,
      durationMs: 300000,
    },
    inputTokens: 0,
    outputTokens: 0,
    modelCostUsd: null,
    searchCostUsd: 0,
  },
  modelVersion: "fixture",
  promptVersion: "fixture",
  durationMs: 0,
});

test("CLI marks partial tokens and renders unknown cost separately from zero", () => {
  const partial = result();
  partial.usage.complete = false;
  partial.usage.inputTokens = 10;
  partial.usage.outputTokens = 20;
  const text = formatCatalogReport([partial], true);
  expect(text).toContain("tokens: 10/20 (partial)");
  expect(text).toContain("model USD: unavailable");
  partial.usage.complete = true;
  partial.usage.modelCostUsd = 0;
  expect(formatCatalogReport([partial], true)).toContain("tokens: 10/20;");
  expect(formatCatalogReport([partial], true)).toContain("model USD: 0;");
});

test("CLI targets an Event and starts fresh research for dry-run and apply", async () => {
  const database = testDatabase();
  const fx = testFixtures();
  const event = fx.event();
  fx.occurrence(event);
  const research = vi.fn<typeof runCatalogResearch>(async () => result());
  const stdout = vi.fn();
  const args = ["check", "--event", event.id, "--database", database.path];
  expect(await executeCatalogCommand(args, { research, stdout })).toBe(0);
  expect(
    await executeCatalogCommand([...args, "--apply", "--republish"], {
      research,
      stdout,
    }),
  ).toBe(0);
  expect(research).toHaveBeenCalledTimes(2);
  expect(research.mock.calls[0][0]).toMatchObject({
    eventId: event.id,
    actor: "catalog-research",
    dryRun: true,
    republish: false,
  });
  expect(research.mock.calls[0][0]).not.toHaveProperty("initiatedBy");
  expect(research.mock.calls[0][0]).not.toHaveProperty("occurrenceIds");
  expect(research.mock.calls[1][0]).toMatchObject({
    dryRun: false,
    republish: true,
  });
});

test("add starts without a named owner and retains the research actor", async () => {
  const database = testDatabase();
  const research = vi.fn<typeof runCatalogResearch>(async () => result());
  expect(
    await executeCatalogCommand(
      ["add", "--name", "Example Festival", "--database", database.path],
      { research },
    ),
  ).toBe(0);
  expect(research.mock.calls[0][0]).toMatchObject({
    mode: "add",
    name: "Example Festival",
    actor: "catalog-research",
    dryRun: true,
  });
  expect(research.mock.calls[0][0]).not.toHaveProperty("initiatedBy");
});

test("one festival failure does not stop another or expose provider payloads", async () => {
  const database = testDatabase();
  const fx = testFixtures();
  const first = fx.event();
  const second = fx.event();
  const research = vi
    .fn()
    .mockRejectedValueOnce(new Error("SECRET provider request body"))
    .mockResolvedValueOnce(result());
  const stdout = vi.fn();
  const code = await executeCatalogCommand(
    [
      "check",
      "--event",
      first.id,
      "--event",
      second.id,
      "--database",
      database.path,
      "--json",
    ],
    { research, stdout },
  );
  expect(code).toBe(1);
  expect(research).toHaveBeenCalledTimes(2);
  const text = stdout.mock.calls[0][0] as string;
  expect(text).toContain("research_failed");
  expect(text).not.toContain("SECRET");
  expect(JSON.parse(text).results).toHaveLength(1);
  expect(JSON.parse(text).schemaVersion).toBe(2);
});

test("text report separates research and catalog status, source summaries, errors, questions, and explanations", () => {
  const output = formatCatalogReport(
    [
      {
        ...result(),
        outcome: "updated",
        researchStatus: "partial",
        eventId: "event-1",
        changes: [
          {
            subject: "event-1",
            field: "summary",
            oldValue: null,
            newValue: "New summary",
            explanations: ["The official page revised its description."],
          },
        ],
        sourceSummaries: [
          {
            url: "https://example.org/info",
            information: "Official description.",
          },
        ],
        sources: [
          {
            attemptedUrl: "https://example.org/info",
            finalUrl: "https://example.org/info",
            retrievedAt: "2026-10-03T12:00:00Z",
            outcome: "ok",
          },
        ],
        errors: [
          {
            code: "source_blocked",
            message: "A page was blocked.",
            stage: "source",
          },
        ],
        unresolved: [{ message: "Price remains unknown.", field: "tickets" }],
        eventNameMismatch: {
          eventId: "event-1",
          storedName: "Saved Name",
          observedName: "Observed Name",
        },
      },
    ],
    true,
  );
  expect(output).toContain("updated (research partial)");
  expect(output).toContain("Why: The official page revised its description.");
  expect(output).toContain("Source summary: https://example.org/info");
  expect(output).toContain("ok: https://example.org/info");
  expect(output).toContain("Error (source/source_blocked)");
  expect(output).toContain("Unresolved: tickets: Price remains unknown.");
  expect(output).toContain("Name differs for event-1");
});

test("text report prints model diagnostic metadata", () => {
  const output = formatCatalogReport(
    [
      {
        ...result(),
        errors: [
          {
            code: "model_failed",
            stage: "research",
            message: "Research model failed",
            diagnostic: {
              errorTypes: ["AI_APICallError", "TypeError"],
              httpStatus: 503,
              providerCode: "ECONNRESET",
              retryable: true,
            },
          },
        ],
      },
    ],
    true,
  );
  expect(output).toContain(
    "Research model failed [type=AI_APICallError>TypeError http=503 code=ECONNRESET retryable=true]",
  );
});

test("JSON report keeps structured model diagnostic metadata", async () => {
  const database = testDatabase();
  const event = testFixtures(database.client).event();
  const stdout = vi.fn();
  await executeCatalogCommand(
    ["check", "--event", event.id, "--database", database.path, "--json"],
    {
      research: async () => ({
        ...result(),
        errors: [
          {
            code: "model_failed",
            stage: "research",
            message: "Research model failed",
            diagnostic: {
              errorTypes: ["AI_APICallError"],
              httpStatus: 429,
              retryable: true,
            },
          },
        ],
      }),
      stdout,
    },
  );
  const report = JSON.parse(stdout.mock.calls[0][0] as string);
  expect(report.results[0].errors[0].diagnostic).toEqual({
    errorTypes: ["AI_APICallError"],
    httpStatus: 429,
    retryable: true,
  });
});

test("partial and skipped results exit zero; failed research and writes exit nonzero", async () => {
  const database = testDatabase();
  const event = testFixtures(database.client).event();
  const args = ["check", "--event", event.id, "--database", database.path];
  for (const outcome of ["unchanged", "skipped"] as const) {
    expect(
      await executeCatalogCommand(args, {
        research: async () => ({
          ...result(),
          outcome,
          researchStatus: "partial",
          unresolved: [{ message: "Optional fact unknown." }],
        }),
        stdout: vi.fn(),
      }),
    ).toBe(0);
  }
  expect(
    await executeCatalogCommand(args, {
      research: async () => ({
        ...result(),
        outcome: "failed",
        researchStatus: "success",
        errors: [
          {
            code: "write_failed",
            stage: "write",
            message: "Catalog write failed",
          },
        ],
      }),
      stdout: vi.fn(),
    }),
  ).toBe(1);
  expect(
    await executeCatalogCommand(args, {
      research: async () => ({
        ...result(),
        outcome: "failed",
        researchStatus: "failed",
        errors: [
          { code: "model_failed", stage: "research", message: "Model failed" },
        ],
      }),
      stdout: vi.fn(),
    }),
  ).toBe(1);
});

function fixtureCandidate(eventId: string) {
  return {
    status: "success",
    data: {
      eventId,
      eventName: "Fixture Fest",
      summary: {
        value: "Updated description",
        reason: "Official page updated its text",
      },
      sources: [],
      links: { socials: {} },
      editions: [],
    },
    errors: [],
    unresolved: [],
  };
}

test("real CLI stores/exports the same report and prints runId with estimated search cost", async () => {
  const database = testDatabase();
  const event = testFixtures().event();
  const reportPath = join(dirname(database.path), "report.json");
  const stdout = vi.fn();
  const args = [
    "refresh",
    "--event",
    event.id,
    "--database",
    database.path,
    "--report",
    reportPath,
  ];
  expect(
    await executeCatalogCommand([...args, "--json"], {
      stdout,
      researchDependencies: {
        generateCandidate: async () => fixtureCandidate(event.id),
      },
    }),
  ).toBe(0);
  const report = JSON.parse(stdout.mock.calls[0][0] as string);
  expect(JSON.parse(readFileSync(reportPath, "utf8"))).toEqual(report);
  const saved = database.client
    .prepare("SELECT report_json FROM ingestion_runs WHERE id=?")
    .get(report.results[0].runId) as { report_json: string };
  expect(JSON.parse(saved.report_json)).toEqual(report.results[0]);
  const text = formatCatalogReport(report.results, true);
  expect(text).toContain(`Run ${report.results[0].runId}:`);
  expect(text).toContain("estimated search USD: 0");
});

test.each(["workflow", "persistence"] as const)(
  "real CLI %s failure preserves useful output and continues independent targets",
  async (failure) => {
    const database = testDatabase();
    const fx = testFixtures();
    const first = fx.event();
    const second = fx.event();
    if (failure === "workflow") {
      vi.spyOn(reportModule, "buildResearchReport").mockImplementationOnce(
        () => {
          throw new Error("SECRET");
        },
      );
    } else {
      database.client.exec(
        `CREATE TRIGGER refuse_first_finish BEFORE UPDATE ON ingestion_runs WHEN OLD.event_id='${first.id}' BEGIN SELECT RAISE(ABORT, 'SECRET'); END`,
      );
    }
    const stdout = vi.fn();
    const code = await executeCatalogCommand(
      [
        "check",
        "--event",
        first.id,
        "--event",
        second.id,
        "--database",
        database.path,
        "--apply",
        "--json",
      ],
      {
        stdout,
        researchDependencies: {
          generateCandidate: async (prompt) =>
            fixtureCandidate(prompt.includes(first.id) ? first.id : second.id),
        },
      },
    );
    expect(code).toBe(1);
    const output = stdout.mock.calls[0][0] as string;
    expect(output).not.toContain("SECRET");
    const report = JSON.parse(output);
    expect(report.results).toHaveLength(2);
    expect(report.results[0].outcome).not.toBe("failed");
    expect(report.results[0].receipts.length).toBeGreaterThan(0);
    expect(report.results[0].runId).not.toBe(report.results[1].runId);
    expect(
      database.client
        .prepare("SELECT summary FROM events WHERE id=?")
        .get(first.id),
    ).toEqual({ summary: "Updated description" });
    if (failure === "persistence") {
      expect(report.failures).toEqual([
        {
          eventId: first.id,
          code: "run_persistence_failed",
          runId: report.results[0].runId,
        },
      ]);
      expect(
        database.client
          .prepare("SELECT status,report_json FROM ingestion_runs WHERE id=?")
          .get(report.results[0].runId),
      ).toEqual({ status: "running", report_json: null });
    } else {
      expect(report.results[0].errors).toContainEqual({
        code: "workflow_failed",
        stage: "workflow",
        message: "Ingestion workflow failed",
      });
    }
  },
);

test("optional file failure keeps the completed run and help/preflight do not start attempts", async () => {
  const database = testDatabase();
  const event = testFixtures().event();
  const stdout = vi.fn();
  expect(await executeCatalogCommand(["--help"], { stdout })).toBe(0);
  await expect(
    executeCatalogCommand(
      ["check", "--event", "missing", "--database", database.path],
      { stdout },
    ),
  ).rejects.toThrow(/not found/);
  expect(database.client.prepare("SELECT * FROM ingestion_runs").all()).toEqual(
    [],
  );
  const path = join(database.path, "impossible.json");
  await expect(
    executeCatalogCommand(
      [
        "refresh",
        "--event",
        event.id,
        "--database",
        database.path,
        "--report",
        path,
      ],
      {
        stdout,
        researchDependencies: {
          generateCandidate: async () => fixtureCandidate(event.id),
        },
      },
    ),
  ).rejects.toThrow();
  expect(
    database.client
      .prepare("SELECT status,report_json FROM ingestion_runs")
      .get(),
  ).toMatchObject({ status: "completed", report_json: expect.any(String) });
});

test("CLI serialization persistence error retains safe available data and correlation", async () => {
  const database = testDatabase();
  const event = testFixtures().event();
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const available = {
    ...result(),
    runId: "unfinished",
    modelResponse: { text: null, object: cycle },
  };
  const stdout = vi.fn();
  expect(
    await executeCatalogCommand(
      ["check", "--event", event.id, "--database", database.path, "--json"],
      {
        stdout,
        research: async () => {
          throw new RunPersistenceError("unfinished", available);
        },
      },
    ),
  ).toBe(1);
  const report = JSON.parse(stdout.mock.calls[0][0] as string);
  expect(report.results[0]).toMatchObject({
    runId: "unfinished",
    usage: available.usage,
    modelResponse: null,
  });
  expect(report.failures[0]).toMatchObject({
    code: "run_persistence_failed",
    runId: "unfinished",
  });
});
