import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import type {
  CatalogResearchResult,
  runCatalogResearch,
} from "@/ingestion/workflow";
import { executeCatalogCommand } from "./catalog";

const result = (): CatalogResearchResult => ({
  mode: "check",
  outcome: "unchanged",
  operations: [],
  receipts: [],
  references: {},
  changes: [],
  sources: [],
  gaps: [],
  usage: {
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
});
