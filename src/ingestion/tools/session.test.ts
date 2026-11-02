import { afterEach, expect, test, vi } from "vitest";
import { createResearchBudget, ResearchLimitError } from "../runtime/budget";
import type { ResearchDependencies } from "../contracts";
import type { KnownSourceLink } from "./contracts";
import type { ReadPageResult } from "./read-page/contracts";
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
const page = (url: string): ReadPageResult => ({
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-04T00:00:00Z",
  status: "ok",
  method: "http",

  markdown: "Festival information",
});

test("long linked-page chains share accounting, caching and the deadline", async () => {
  let current = 0;
  const budget = createResearchBudget({}, () => current);
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const chain = Array.from(
    { length: 5 },
    (_, index) => `${homepage}step/${index}`,
  );
  const readPage = vi.fn<NonNullable<ResearchDependencies["readPage"]>>(
    async (url, options) => {
      options.budget.consumePage();
      const next = url === homepage ? chain[0] : chain[chain.indexOf(url) + 1];
      return { ...page(url), markdown: next ? `[Next](${next})` : "End" };
    },
  );
  const sources = createSourceSession(budget, config, knownLinks, {
    readPage,
    searchWeb: async (query, options) => {
      options.budget.consumeSearch();
      options.budget.consumeModelCall();
      return {
        query,
        candidates: [
          {
            url: discovered,
            title: "Tickets",
            highlights: ["Published programme"],
          },
        ],
        retrievedAt: page(discovered).retrievedAt,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  });
  await sources.readInitialSource();
  await sources.readPage(tickets);
  for (const url of chain) {
    expect(sources.reads.some((read) => read.markdown.includes(url))).toBe(
      true,
    );
    expect(await sources.readPage(url)).toMatchObject({ status: "ok" });
  }
  expect(
    (await sources.searchWeb("Festival tickets")).candidates[0].highlights,
  ).toEqual(["Published programme"]);
  await sources.readPage(discovered);
  const count = readPage.mock.calls.length;
  await sources.readPage(chain[4]);
  expect(readPage).toHaveBeenCalledTimes(count);
  expect(budget.snapshot()).toMatchObject({
    pages: 8,
    searches: 1,
    modelCalls: 1,
  });
  current = budget.deadline;
  await expect(sources.readPage(checkout)).rejects.toMatchObject({
    limit: "time",
  });
  expect(budget.snapshot().pages).toBe(8);
});

test("discovery calls share search limits without reserving model capacity", async () => {
  const budget = createResearchBudget({ searches: 2 });
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const sources = createSourceSession(budget, config, [], {
    searchWeb: async (query, options) => {
      options.budget.consumeSearch();
      options.budget.consumeModelCall();
      return {
        query,
        candidates: [],
        retrievedAt: new Date().toISOString(),
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  });
  await sources.searchWeb("Festival");
  await sources.searchWeb("Festival tickets");
  expect(budget.snapshot()).toMatchObject({ searches: 2, modelCalls: 2 });
});

test("initial read suppresses only budget limits, leaving other exceptions visible", async () => {
  const budget = createResearchBudget();
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const readPage = vi
    .fn<NonNullable<ResearchDependencies["readPage"]>>()
    .mockRejectedValueOnce(new ResearchLimitError("time"))
    .mockRejectedValueOnce(new Error("Source adapter failed"));
  const sources = createSourceSession(budget, config, knownLinks, {
    readPage,
  });
  await expect(sources.readInitialSource()).resolves.toBeUndefined();
  await expect(sources.readInitialSource()).rejects.toThrow(
    "Source adapter failed",
  );
  expect(sources.reads).toEqual([]);
});

test("cache observations belong to each call, including concurrent duplicates and redirect aliases", async () => {
  const budget = createResearchBudget();
  let release!: (result: ReadPageResult) => void;
  const readPage = vi.fn<NonNullable<ResearchDependencies["readPage"]>>(
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
    { readPage },
  );
  const readWithObservation = async () => {
    const cached = sources.isReadCached(homepage);
    const result = await sources.readPage(homepage);
    return { cached, result };
  };
  const first = readWithObservation();
  const second = readWithObservation();
  release({
    ...page(homepage),
    finalUrl: tickets,
    markdown:
      "## Map\n\nVenue: Buchanan Park · latitude: 39.6858145 · longitude: -105.3640047",
  });
  const observations = await Promise.all([first, second]);
  expect(observations.map(({ cached }) => cached)).toEqual([false, true]);
  expect(observations[0].result).toBe(observations[1].result);
  expect(observations[0].result.markdown).toContain("Venue: Buchanan Park");
  expect(sources.isReadCached(homepage)).toBe(true);
  expect(sources.isReadCached(tickets)).toBe(true);
  expect(await sources.readPage(tickets)).toBe(observations[0].result);
  expect(readPage).toHaveBeenCalledTimes(1);
  expect(budget.snapshot().pages).toBe(1);
});

test.each(["ok", "unsupported", "failed"] as const)(
  "source logs keep %s diagnostics without page content",
  async (status) => {
    const log = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    log.child.mockReturnValue(log);
    const budget = createResearchBudget();
    const sources = createSourceSession(
      budget,
      { apiKey: "fixture", model: "fixture", limits: budget.limits },
      [],
      {
        readPage: async (url) => ({
          ...page(url),
          status,
          reasonCode: "test_limit",
          markdown: "PRIVATE_PAGE_BODY",
        }),
      },
      log,
    );
    await sources.readPage(homepage);
    const calls = [...log.info.mock.calls, ...log.warn.mock.calls];
    const finished = calls.find(
      ([message]) => message === "Source read finished",
    )![1];
    expect(finished).toMatchObject({
      status,
      reasonCode: "test_limit",
      sourceCharacters: 17,
    });
    for (const field of [
      "outcome",
      "reason",
      "completeness",
      "sourceTruncated",
      "toolTruncated",
      "truncated",
      "markdown",
      "links",
    ]) {
      expect(finished).not.toHaveProperty(field);
    }
    expect(JSON.stringify(calls)).not.toContain("PRIVATE_PAGE_BODY");
  },
);
