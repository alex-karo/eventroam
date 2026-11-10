import { expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCollection } from "./collection";
import { createSourceSession } from "../tools/session";
import { createResearchBudget } from "../runtime/budget";
import type { GenerateRole } from "../roles/invoke";
import { wholeNumberedPage } from "@/test/ingestion";
import { segmentPage } from "./segments";

it("shares a complete inspection, reserves concurrent Reader calls and freezes after settlement", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-collection-"));
  try {
    const coverage = {
      found: ["Festival identity"],
      notPublished: ["The source says no street address is published."],
    };
    const budget = createResearchBudget();
    const config = {
      apiKey: "fixture",
      model: "fixture",
      limits: budget.limits,
    };
    const fetch = vi.fn(async (url: string) => ({
      attemptedUrl: url,
      finalUrl: url,
      retrievedAt: "2026-10-31T00:00:00Z",
      status: "ok" as const,
      method: "http" as const,
      markdown: `# Festival 2027\n${url}\nNo street address is published.`,
    }));
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generate = vi.fn<GenerateRole>(async (_role, prompt) => {
      await barrier;
      const input = JSON.parse(prompt);
      return {
        overview: "Festival page",
        coverage,
        topics: ["identity"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: wholeNumberedPage(input.page),
            context: [],
            topics: ["identity", "description"],
            editionClues: ["2027"],
            uncertainty: null,
          },
        ],
      };
    });
    const session = createSourceSession(budget, config, [], {
      readPage: fetch,
    });
    const collection = createCollection({
      runId: "test-run",
      startedAt: Date.now(),
      sources: session,
      budget,
      config,
      deps: { generateRole: generate },
      assignment: {},
      root,
      limits: {
        readerCalls: 1,
        pageInputCharacters: 10000,
        inputReserveCharacters: 100,
        readerOutputTokens: 1000,
      },
    });
    const first = collection.inspectPage("https://example.org/one");
    const duplicate = collection.inspectPage("https://example.org/one");
    const second = collection.inspectPage("https://example.org/two");
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    let frozen = false;
    const freeze = collection.freeze().then((value) => {
      frozen = true;
      return value;
    });
    expect(frozen).toBe(false);
    release();
    const [a, b, c] = await Promise.all([first, duplicate, second]);
    const corpus = await freeze;
    expect(a.sourceId).toBe(b.sourceId);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect([a.processing, c.processing].sort()).toEqual([
      "complete",
      "unprocessed",
    ]);
    expect(corpus.evidence).toHaveLength(1);
    const processed = [a, c].find(
      (result) => result.processing === "complete",
    )!;
    const unprocessed = [a, c].find(
      (result) => result.processing === "unprocessed",
    )!;
    expect(processed.coverage).toEqual(coverage);
    expect(
      corpus.sources.find((source) => source.id === processed.sourceId)
        ?.coverage,
    ).toEqual(coverage);
    expect(unprocessed.coverage).toBeNull();
    expect(processed.limitations).toEqual([]);
    expect(JSON.stringify(a)).not.toContain("evidenceIds");
    expect(JSON.stringify(a)).not.toContain("Festival 2027");
    await expect(
      collection.inspectPage("https://example.org/three"),
    ).rejects.toThrow("closed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("keeps an oversized whole page without calling Reader or processing a prefix", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-oversized-"));
  try {
    const page = "Early price: €5\n" + "x".repeat(10000) + "\n2027 price: €100";
    const { collection, generate } = collectionFixture(root, page, 1000);
    const result = await collection.inspectPage("https://example.org/large");
    const corpus = await collection.freeze();
    expect(result.processing).toBe("unprocessed");
    expect(result.coverage).toBeNull();
    expect(generate).not.toHaveBeenCalled();
    expect(corpus.evidence).toEqual([]);
    expect(await readCanonicalSource(corpus.sources[0])).toBe(page);
    expect(corpus.sources[0].limitations.join(" ")).toContain("Whole page");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("does not call Reader when the required source artifact cannot be saved", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-storage-failure-"));
  try {
    const file = join(root, "not-a-directory");
    await writeFile(file, "fixture");
    const { collection, generate } = collectionFixture(file, "A page", 1000);
    await expect(
      collection.inspectPage("https://example.org/"),
    ).rejects.toThrow();
    expect(collection.fatal).toBe(true);
    expect(generate).not.toHaveBeenCalled();
    expect((await collection.freeze()).sources).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { writeFile } from "node:fs/promises";
import { readCanonicalSource } from "./storage";

function collectionFixture(
  root: string,
  page: string | ((url: string) => string),
  pageInputCharacters: number,
  readerCalls = 2,
) {
  const budget = createResearchBudget();
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const generate = vi.fn<GenerateRole>(async () => ({
    overview: "Page",
    coverage: { found: [], notPublished: [] },
    topics: [],
    statedYears: [],
    limitations: [],
    evidence: [],
  }));
  const sources = createSourceSession(budget, config, [], {
    readPage: async (url) => ({
      attemptedUrl: url,
      finalUrl: url,
      retrievedAt: "2026-10-31T00:00:00Z",
      status: "ok",
      method: "http",
      markdown: typeof page === "string" ? page : page(url),
    }),
  });
  return {
    generate,
    collection: createCollection({
      runId: "test-run",
      startedAt: Date.now(),
      sources,
      budget,
      config,
      deps: { generateRole: generate },
      assignment: {},
      root,
      limits: {
        readerCalls,
        pageInputCharacters,
        inputReserveCharacters: 100,
        readerOutputTokens: 1000,
      },
    }),
  };
}

it("keeps usable Reader quotations when other quotations have no topic or valid segment", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-partial-reader-"));
  try {
    const page = "# Festival\n\nCookies\n\nTickets cost €20.";
    const { collection, generate } = collectionFixture(root, page, 10000, 1);
    generate.mockResolvedValueOnce({
      overview: "Festival tickets",
      coverage: { found: ["Ticket price"], notPublished: [] },
      topics: [],
      statedYears: [],
      limitations: [],
      evidence: [
        { quote: 2, topics: [] },
        { quote: 4, topics: ["tickets"] },
        { quote: 0, topics: ["tickets"] },
        {
          quote: 3,
          context: [{ start: -1, end: 2 }],
          editionClues: [],
          uncertainty: null,
          topics: ["tickets"],
        },
        { quote: 3, topics: ["tickets"] },
      ],
    });

    const result = await collection.inspectPage("https://example.org/");
    const corpus = await collection.freeze();

    expect(result.processing).toBe("limited");
    expect(result.limitations).toEqual([
      "Quotation 1 has no topic",
      "Quotation 2 or its context has an invalid segment selection",
      "Quotation 3 or its context has an invalid segment selection",
      "Quotation 4 or its context has an invalid segment selection",
    ]);
    expect(corpus.evidence).toEqual([
      expect.objectContaining({
        id: `${result.sourceId}-e5`,
        quote: "Tickets cost €20.",
        topics: ["tickets"],
      }),
    ]);
    expect(collection.fatal).toBe(false);
    expect(collection.errors).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each([
  { readerCalls: 1, processing: "failed", savedEvidence: 0 },
  { readerCalls: 2, processing: "complete", savedEvidence: 1 },
])(
  "uses the Reader call allowance for a correction (limit $readerCalls)",
  async ({ readerCalls, processing, savedEvidence }) => {
    const root = await mkdtemp(join(tmpdir(), "eventroam-reader-correction-"));
    try {
      const page = "# Festival\n\nTickets cost €20.";
      const { collection, generate } = collectionFixture(
        root,
        page,
        10000,
        readerCalls,
      );
      const output = {
        overview: "Festival tickets",
        coverage: { found: ["Ticket price"], notPublished: [] },
        topics: ["tickets"],
        statedYears: [],
        limitations: [],
        evidence: [{ quote: 2, topics: ["tickets"] }],
      };
      generate
        .mockResolvedValueOnce({
          ...output,
          coverage: {
            found: Array.from(
              { length: 10 },
              (_, index) => `Label ${index + 1}`,
            ),
            notPublished: [],
          },
        })
        .mockImplementationOnce(async (_role, prompt) => {
          expect(JSON.parse(prompt)).toMatchObject({
            page: "1|# Festival\n\n2|Tickets cost €20.",
            validationFeedback: {
              instructions: expect.stringContaining("same numbered page"),
              errors: [
                expect.objectContaining({
                  message: expect.stringMatching(
                    /coverage\.found:too_big .*<=9/,
                  ),
                }),
              ],
            },
          });
          return output;
        });

      const result = await collection.inspectPage("https://example.org/");
      const other = await collection.inspectPage("https://example.org/other");
      const corpus = await collection.freeze();

      expect(result.processing).toBe(processing);
      expect(other.processing).toBe("unprocessed");
      expect(corpus.evidence).toHaveLength(savedEvidence);
      expect(collection.fatal).toBe(processing === "failed");
      expect(generate).toHaveBeenCalledTimes(readerCalls);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it("gives Reader the full page and reuses a redirected source for later inspection", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-full-page-"));
  try {
    const budget = createResearchBudget();
    const config = {
      apiKey: "fixture",
      model: "fixture",
      limits: budget.limits,
    };
    const page =
      "# Tickets 2027\n" +
      "Background\n".repeat(10000) +
      "\n| Pass | €100 |\n| Day | €50 |\n\nIncludes tax.";
    const generate = vi.fn<GenerateRole>(async (role, prompt, call) => {
      expect(role).toBe("reader");
      expect(call.tools).toBeUndefined();
      expect(JSON.parse(prompt).page).toBe(segmentPage(page).numbered);
      return {
        overview: "Price table for 2027",
        coverage: { found: [], notPublished: [] },
        topics: ["tickets"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: { start: 10002, end: 10003 },
            context: [1, 10004],
            topics: ["tickets"],
            editionClues: ["2027"],
            uncertainty: null,
          },
        ],
      };
    });
    const fetch = vi.fn(async (url: string) => ({
      attemptedUrl: url,
      finalUrl: "https://example.org/tickets",
      retrievedAt: "2026-10-31T00:00:00Z",
      status: "ok" as const,
      method: "http" as const,
      markdown: page,
    }));
    const collection = createCollection({
      runId: "test-run",
      startedAt: Date.now(),
      sources: createSourceSession(budget, config, [], { readPage: fetch }),
      budget,
      config,
      deps: { generateRole: generate },
      assignment: {},
      root,
    });
    const first = await collection.inspectPage("https://example.org/");
    const redirected = await collection.inspectPage(
      "https://example.org/tickets",
    );
    expect(redirected.sourceId).toBe(first.sourceId);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    const corpus = await collection.freeze();
    expect(corpus.evidence[0].span.start).toBeGreaterThan(80000);
    expect(corpus.evidence[0].context).toHaveLength(2);
    expect(corpus.sources).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("returns actual page leads when Reader extracts no evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-leads-"));
  try {
    const { collection } = collectionFixture(
      root,
      "[Tickets](/tickets?edition=2027)",
      10000,
    );
    const result = await collection.inspectPage("https://example.org/");
    expect(result.leads).toEqual([
      { url: "https://example.org/tickets?edition=2027", label: "Tickets" },
    ]);
    const corpus = await collection.freeze();
    expect(corpus.evidence).toEqual([]);
    expect(corpus.sources[0].leads).toEqual(result.leads);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("shows each navigation URL and label once without changing saved source leads", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-navigation-"));
  try {
    const { collection } = collectionFixture(
      root,
      (url) =>
        url.endsWith("/one")
          ? "[Tickets](/shop?edition=2027)\n[Travel](/travel)"
          : "[Pass conditions](/shop?edition=2027)\n[Travel](/travel)\n[Next tickets](/shop?edition=2028)",
      10000,
    );
    await collection.inspectPage("https://example.org/one");
    const initial = collection.navigationPages();
    expect(initial[0].leads).toHaveLength(2);
    const second = await collection.inspectPage("https://example.org/two");
    expect(second.leads).toEqual([
      {
        url: "https://example.org/shop?edition=2027",
        label: "Pass conditions",
      },
      { url: "https://example.org/shop?edition=2028", label: "Next tickets" },
    ]);
    const cached = await collection.inspectPage("https://example.org/one");
    expect(cached.leads).toEqual([]);
    expect(collection.sources[0].leads).toEqual(initial[0].leads);
    expect(collection.sources[1].leads).toHaveLength(3);
    await collection.freeze();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
