import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindEvidence, evidencePacket, readerOutputSchema } from "./contracts";
import {
  createCorpusStorage,
  readCanonicalSource,
  sourceArtifactRoot,
} from "./storage";

describe("saved source evidence", () => {
  it("recovers a complete passage between literal boundaries, with links and conditions", () => {
    const passage =
      "## Festival passes 2027\n" +
      "Weekend admission and camping.\n".repeat(200) +
      "[Buy a pass](../tickets) for €100.\n" +
      "Includes tax. Children under 12 enter free with an adult.\n" +
      "* Mandatory booking fee: €5 per order.";
    const page = `🎪\nUnrelated text\n${passage}\nOther content`;
    const bounds = {
      start: "## Festival passes 2027",
      end: "* Mandatory booking fee: €5 per order.",
    };
    const output = readerOutputSchema.parse({
      overview: "Festival admission conditions",
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        {
          quote: bounds,
          context: [],
          topics: ["tickets", "links"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/info/");
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0].quote).toBe(passage);
    expect(
      page.slice(bound.evidence[0].span.start, bound.evidence[0].span.end),
    ).toBe(passage);
    expect(bound.evidence[0].anchors).toEqual([
      { url: "https://example.org/tickets", label: "Buy a pass" },
    ]);
    expect(output.evidence[0].quote).toEqual(bounds);
  });

  it.each([
    ["ambiguous start", "Start\nStart\nEnd", { start: "Start", end: "End" }],
    ["ambiguous end", "Start\nEnd\nEnd", { start: "Start", end: "End" }],
    ["missing boundary", "Start\nEnd", { start: "Absent", end: "End" }],
    ["reversed boundaries", "End\nStart", { start: "Start", end: "End" }],
    ["overlapping boundaries", "StartEnd", { start: "StartE", end: "tEnd" }],
    [
      "span over the limit",
      `Start${"x".repeat(24000)}End`,
      { start: "Start", end: "End" },
    ],
  ])("rejects %s and keeps other evidence", (_name, body, quote) => {
    const output = readerOutputSchema.parse({
      overview: "A source page",
      topics: ["tickets"],
      statedYears: [],
      limitations: [],
      evidence: [quote, "A valid short quote"].map((quote) => ({
        quote,
        context: [],
        topics: ["tickets"],
        editionClues: [],
        uncertainty: null,
      })),
    });
    const bound = bindEvidence(
      "s1",
      `${body}\nA valid short quote`,
      output,
      "https://example.org/",
    );
    expect(bound.limitations).toHaveLength(1);
    expect(bound.evidence).toHaveLength(1);
    expect(bound.evidence[0].quote).toBe("A valid short quote");
    expect(bound.evidence[0].id).toBe("s1-e2");
  });

  it("requires short literal boundaries and a strict boundary object", () => {
    const output = {
      overview: "A source page",
      topics: [],
      statedYears: [],
      limitations: [],
      evidence: [
        {
          quote: { start: "Start", end: "End" },
          context: [],
          topics: ["tickets"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    };
    for (const quote of [
      { start: "", end: "End" },
      { start: "Start", end: "x".repeat(251) },
      { start: "Start", end: "End", extra: true },
    ]) {
      expect(
        readerOutputSchema.safeParse({
          ...output,
          evidence: [{ ...output.evidence[0], quote }],
        }).success,
      ).toBe(false);
    }
  });

  it("derives only usable destinations from matched quotes and literal context", () => {
    const page =
      "Newsletter [Radio]()\n\n[Pass][buy]\n\n[buy]: ../shop?edition=2027";
    const output = readerOutputSchema.parse({
      overview: "A ticket link and an empty radio link",
      topics: ["links"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        {
          quote: "Newsletter [Radio]()\n\n[Pass][buy]",
          context: ["[buy]: ../shop?edition=2027"],
          topics: ["links"],
          editionClues: ["2027"],
          uncertainty: null,
        },
      ],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/info/");
    const corpus = {
      version: "test",
      evidence: bound.evidence,
      sources: [
        {
          id: "s1",
          attemptedUrl: "https://example.org/info/",
          finalUrl: "https://example.org/info/",
          retrievedAt: "2026-10-31T00:00:00Z",
          status: "ok" as const,
          method: "http" as const,
          processing: "complete" as const,
          limitations: [],
        },
      ],
    };
    const interpretation = evidencePacket(corpus, ["links"]).evidence[0];
    const links = evidencePacket(corpus, ["links"], { anchors: true })
      .evidence[0];
    expect(interpretation).not.toHaveProperty("anchors");
    expect(links.anchors).toEqual(bound.evidence[0].anchors);
    const emptyOptional = {
      ...bound.evidence[0],
      context: [],
      editionClues: [],
      uncertainty: null,
      anchors: [],
    };
    const compact = evidencePacket(
      { ...corpus, evidence: [emptyOptional] },
      ["links"],
      { anchors: true },
    ).evidence[0];
    for (const field of ["context", "editionClues", "uncertainty", "anchors"]) {
      expect(compact).not.toHaveProperty(field);
    }
    expect(compact.source).toEqual({ finalUrl: corpus.sources[0].finalUrl });
    expect(emptyOptional.context).toEqual([]);
    expect(corpus.sources[0].retrievedAt).toBe("2026-10-31T00:00:00Z");
    expect(interpretation.quote).toBe(links.quote);
    expect(interpretation.context).toEqual(links.context);
    expect(corpus.evidence[0].anchors).toEqual(links.anchors);
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0].anchors).toEqual([
      { url: "https://example.org/shop?edition=2027", label: "Pass" },
    ]);
    expect(bound.evidence[0].context[0].quote).toBe(
      "[buy]: ../shop?edition=2027",
    );
  });
  it("anchors Unicode, distant context and a shared price table; rejects ambiguous or joined quotes", () => {
    const page =
      "🎪\n# 2027\n" +
      "Background\n".repeat(10000) +
      "| Full | €100 |\n| Day | €50 |\n\nIncludes tax.\nSame\nSame";
    const output = readerOutputSchema.parse({
      overview: "A price page",
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        {
          quote: "| Full | €100 |\n| Day | €50 |",
          context: ["# 2027", "Includes tax."],
          topics: ["tickets", "description"],
          editionClues: ["2027"],
          uncertainty: null,
        },
        {
          quote: "Same",
          context: [],
          topics: ["tickets"],
          editionClues: [],
          uncertainty: null,
        },
        {
          quote: "# 2027 Includes tax.",
          context: [],
          topics: ["tickets"],
          editionClues: [],
          uncertainty: null,
        },
        {
          quote: "Includes tax.",
          context: ["Missing heading"],
          topics: ["tickets"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/");
    expect(bound.evidence).toHaveLength(1);
    const item = bound.evidence[0];
    expect(page.slice(item.span.start, item.span.end)).toBe(item.quote);
    expect(item.span.start).toBeGreaterThan(80000);
    expect(item.context[0].span.start).toBe(3);
    expect(item.topics).toEqual(["tickets", "description"]);
    expect(bound.limitations).toHaveLength(3);
  });
  it("recovers the exact body, separates provenance, and prevents writes after freeze", async () => {
    const root = await mkdtemp(join(tmpdir(), "eventroam-evidence-"));
    try {
      const store = createCorpusStorage("run-1", root);
      const body = "---\ntitle: Website claim\n---\n\n🎪 source\n";
      const source = await store.savePage({
        attemptedUrl: "https://example.org/",
        finalUrl: "https://example.org/2027",
        retrievedAt: "2026-10-31T00:00:00Z",
        method: "http",
        status: "ok",
        markdown: body,
      });
      expect(await readCanonicalSource(source)).toBe(body);
      expect(await readFile(source.markdownPath!, "utf8")).toContain(
        '"application"',
      );
      await store.saveEvidence(source, []);
      const corpus = store.freeze();
      expect(corpus.sources[0].evidencePath).toBeTruthy();
      await expect(store.saveEvidence(source, [])).rejects.toThrow("frozen");
      expect(
        sourceArtifactRoot({ CATALOG_SOURCE_DIRECTORY: "data/private" }),
      ).toMatch(/eventroam\/data\/private$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
