import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import type {
  CatalogResearchResult,
  runCatalogResearch,
} from "@/ingestion/workflow";
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
      pages: 20,
      modelCalls: 10,
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
