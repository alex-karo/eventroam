import { afterEach, expect, test, vi } from "vitest";
import { createResearchBudget, ResearchLimitError } from "../runtime/budget";
import type { ResearchDependencies } from "../contracts";
import type { KnownSourceLink } from "./contracts";
import type { ReadSourceResult } from "./read-source/contracts";
import { createSourceSession } from "./session";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const homepage = "https://example.org/";
const tickets = "https://example.org/tickets";
const checkout = "https://example.org/checkout";
const discovered = "https://tickets.example.org/";
const knownLinks: KnownSourceLink[] = [
  { url: tickets, owner: "event", kind: "tickets", official: true },
  { url: homepage, owner: "event", kind: "official_site", official: false },
];
const page = (url: string): ReadSourceResult => ({
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-04T00:00:00Z",
  outcome: "ok",
  method: "http",
  completeness: "full",
  markdown: "Festival information",
  links: [],
});

test("long linked-page chains share accounting, caching and the deadline", async () => {
  let current = 0;
  const budget = createResearchBudget({}, () => current);
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const chain = Array.from(
    { length: 5 },
    (_, index) => `${homepage}step/${index}`,
  );
  const readSource = vi.fn<NonNullable<ResearchDependencies["readSource"]>>(
    async (url, options) => {
      options.budget.consumePage();
      const next = url === homepage ? chain[0] : chain[chain.indexOf(url) + 1];
      return { ...page(url), links: next ? [next] : [] };
    },
  );
  const sources = createSourceSession(budget, config, knownLinks, {
    readSource,
    discoverSources: async (query, options) => {
      options.budget.consumeSearch();
      options.budget.consumeModelCall();
      return {
        query,
        candidates: [{ url: discovered, title: "Tickets" }],
        retrievedAt: page(discovered).retrievedAt,
        modelCostUsd: null,
        searchCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  });
  await sources.readInitialSource();
  await sources.readSource(tickets);
  for (const url of chain) {
    expect(sources.reads.some((read) => read.links.includes(url))).toBe(true);
    expect(await sources.readSource(url)).toMatchObject({ outcome: "ok" });
  }
  await sources.discoverSources("Festival tickets");
  await sources.readSource(discovered);
  const count = readSource.mock.calls.length;
  await sources.readSource(chain[4]);
  expect(readSource).toHaveBeenCalledTimes(count);
  expect(budget.snapshot()).toMatchObject({
    pages: 8,
    searches: 1,
    modelCalls: 1,
  });
  current = budget.deadline;
  await expect(sources.readSource(checkout)).rejects.toMatchObject({
    limit: "time",
  });
  expect(budget.snapshot().pages).toBe(8);
});

test("discovery calls share search limits without reserving model capacity", async () => {
  const budget = createResearchBudget({ searches: 2 });
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const sources = createSourceSession(budget, config, [], {
    discoverSources: async (query, options) => {
      options.budget.consumeSearch();
      options.budget.consumeModelCall();
      return {
        query,
        candidates: [],
        retrievedAt: new Date().toISOString(),
        modelCostUsd: null,
        searchCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  });
  await sources.discoverSources("Festival");
  await sources.discoverSources("Festival tickets");
  expect(budget.snapshot()).toMatchObject({ searches: 2, modelCalls: 2 });
});

test("initial read suppresses only budget limits, leaving other exceptions visible", async () => {
  const budget = createResearchBudget();
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const readSource = vi
    .fn<NonNullable<ResearchDependencies["readSource"]>>()
    .mockRejectedValueOnce(new ResearchLimitError("time"))
    .mockRejectedValueOnce(new Error("Source adapter failed"));
  const sources = createSourceSession(budget, config, knownLinks, {
    readSource,
  });
  await expect(sources.readInitialSource()).resolves.toBeUndefined();
  await expect(sources.readInitialSource()).rejects.toThrow(
    "Source adapter failed",
  );
  expect(sources.reads).toEqual([]);
});

test("cache observations belong to each call, including concurrent duplicates and redirect aliases", async () => {
  const budget = createResearchBudget();
  let release!: (result: ReadSourceResult) => void;
  const readSource = vi.fn<NonNullable<ResearchDependencies["readSource"]>>(
    (_url, options) => {
      options.budget.consumePage();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  );
  const sources = createSourceSession(
    budget,
    { apiKey: "fixture", model: "fixture", limits: budget.limits },
    [],
    { readSource },
  );
  const readWithObservation = async () => {
    const cached = sources.isReadCached(homepage);
    const result = await sources.readSource(homepage);
    return { cached, result };
  };
  const first = readWithObservation();
  const second = readWithObservation();
  release({ ...page(homepage), finalUrl: tickets });
  const observations = await Promise.all([first, second]);
  expect(observations.map(({ cached }) => cached)).toEqual([false, true]);
  expect(observations[0].result).toBe(observations[1].result);
  expect(sources.isReadCached(homepage)).toBe(true);
  expect(sources.isReadCached(tickets)).toBe(true);
  expect(await sources.readSource(tickets)).toBe(observations[0].result);
  expect(readSource).toHaveBeenCalledTimes(1);
  expect(budget.snapshot().pages).toBe(1);
});
