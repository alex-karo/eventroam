import { afterEach, expect, test, vi } from "vitest";
import { createResearchBudget, ResearchLimitError } from "../runtime/budget";
import type { ResearchDependencies } from "../contracts";
import type { KnownSourceLink, ReadSourceResult } from "./contracts";
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

test("saved and discovered URLs start at depth zero; followed links keep their depth", async () => {
  const budget = createResearchBudget({ depth: 0 });
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const readSource = vi.fn<NonNullable<ResearchDependencies["readSource"]>>(
    async (url, options) => {
      options.budget.consumePage(options.depth);
      return { ...page(url), links: [checkout] };
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
  expect(sources.reads[0].attemptedUrl).toBe(homepage);
  await sources.readSource(tickets);
  await expect(sources.readSource(checkout)).rejects.toMatchObject({
    limit: "depth",
  });
  await sources.discoverSources("Festival tickets");
  await sources.readSource(discovered);
  expect(readSource.mock.calls.map(([, options]) => options.depth)).toEqual([
    0, 0, 1, 0,
  ]);
  expect(
    readSource.mock.calls.every(([, options]) => options.budget === budget),
  ).toBe(true);
  expect(budget.snapshot()).toMatchObject({
    pages: 3,
    searches: 1,
    modelCalls: 1,
  });
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
    .mockRejectedValueOnce(new ResearchLimitError("depth"))
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
