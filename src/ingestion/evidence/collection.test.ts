import { expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCollection } from "./collection";
import { createSourceSession } from "../tools/session";
import { createResearchBudget } from "../runtime/budget";
import type { GenerateRole } from "../roles/invoke";

it("shares a complete inspection, reserves concurrent Reader calls and freezes after settlement", async () => {
  const root = await mkdtemp(join(tmpdir(), "eventroam-collection-"));
  try {
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
      markdown: `# Festival 2027\n${url}`,
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
        topics: ["identity"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: input.page,
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
        downstreamReserveMs: 1000,
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
) {
  const budget = createResearchBudget();
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  const generate = vi.fn<GenerateRole>(async () => ({
    overview: "Page",
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
      sources,
      budget,
      config,
      deps: { generateRole: generate },
      assignment: {},
      root,
      limits: {
        readerCalls: 2,
        pageInputCharacters,
        inputReserveCharacters: 100,
        readerOutputTokens: 1000,
        downstreamReserveMs: 1000,
      },
    }),
  };
}

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
      expect(JSON.parse(prompt).page).toBe(page);
      return {
        overview: "Price table for 2027",
        topics: ["tickets"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [
          {
            quote: "| Pass | €100 |\n| Day | €50 |",
            context: ["# Tickets 2027", "Includes tax."],
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
