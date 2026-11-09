import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindEvidence,
  bindSelectedEvidence,
  evidencePacket,
} from "./contracts";
import { segmentPage } from "./segments";
import { readerSelectionSchema } from "../roles/reader/contracts";
import {
  createCorpusStorage,
  readCanonicalSource,
  sourceArtifactRoot,
} from "./storage";

describe("saved source evidence", () => {
  it("binds the selected occurrence and restores original Markdown for its context", () => {
    const price = "  \\+ Handling fee €5  ";
    const passage = `${price}\r\n\r\n[Buy a pass](../tickets)`;
    const page = `🎪\r\n# 2026\r\n${price}\r\n# 2027\r\n${passage}\r\n`;
    const { numbered, spans } = segmentPage(page);
    expect(numbered).toBe(
      `1|🎪\r\n2|# 2026\r\n3|${price}\r\n4|# 2027\r\n5|${price}\r\n\r\n6|[Buy a pass](../tickets)\r\n`,
    );
    const bound = bindSelectedEvidence(
      "s1",
      page,
      {
        limitations: [],
        evidence: [
          {
            quote: { start: 5, end: 6 },
            context: [4],
            topics: ["tickets", "links"],
            editionClues: [],
            uncertainty: null,
          },
          { quote: 5, topics: ["tickets"] },
          { quote: { start: 6, end: 5 }, topics: ["tickets"] },
          {
            quote: 5,
            context: [7],
            topics: ["tickets"],
            editionClues: [],
            uncertainty: null,
          },
        ],
      },
      "https://example.org/info/",
      spans,
    );
    expect(bound.evidence).toMatchObject([
      {
        quote: passage,
        span: {
          start: page.lastIndexOf(price),
          end: page.length - 2,
        },
        context: [{ quote: "# 2027", span: spans[3] }],
        anchors: [{ url: "https://example.org/tickets", label: "Buy a pass" }],
      },
      { quote: price, span: spans[4] },
    ]);
    expect(bound.limitations).toEqual([
      "Quotation 3 or its context has an invalid segment selection",
      "Quotation 4 or its context has an invalid segment selection",
    ]);
  });

  it("splits long lines without breaking Unicode or accepting oversized passages", () => {
    const page = `${"x".repeat(1999)}🎪${"y".repeat(24000)}`;
    const { spans, numbered } = segmentPage(page);
    expect(numbered).toContain("\n2|🎪");
    expect(spans.map(({ start, end }) => page.slice(start, end)).join("")).toBe(
      page,
    );
    const bound = bindSelectedEvidence(
      "s1",
      page,
      {
        limitations: [],
        evidence: [
          { quote: { start: 1, end: spans.length }, topics: ["identity"] },
        ],
      },
      "https://example.org/",
      spans,
    );
    expect(bound.evidence).toEqual([]);
    expect(bound.limitations).toHaveLength(1);
  });

  it("restores empty metadata for short items and retains required context for full items", () => {
    const page = "# 2027\nFull pass €100.\nChildren enter free.";
    const short = { quote: 2, topics: ["tickets"] };
    const full = {
      quote: 3,
      topics: ["tickets"],
      context: [1],
      editionClues: [],
      uncertainty: "Age limit is not stated.",
    };
    const output = readerSelectionSchema.parse({
      overview: "Admission offers",
      coverage: { found: [], notPublished: [] },
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [short, full, { ...full, context: [4] }],
    });
    const bound = bindSelectedEvidence(
      "s1",
      page,
      output,
      "https://example.org/",
      segmentPage(page).spans,
    );
    expect(output.evidence[0]).toEqual(short);
    expect(bound.evidence).toHaveLength(2);
    expect(bound.evidence[0]).toMatchObject({
      context: [],
      editionClues: [],
      uncertainty: null,
    });
    expect(bound.evidence[1]).toMatchObject({
      context: [{ quote: "# 2027" }],
      uncertainty: full.uncertainty,
    });
    expect(bound.limitations).toHaveLength(1);
  });

  it("retains literal evidence when navigation text exceeds length guidance", () => {
    const page = "Start\nFull pass €100.\nEnd";
    const longText = "Source detail. ".repeat(150);
    const output = readerSelectionSchema.parse({
      overview: longText,
      coverage: { found: [longText], notPublished: [longText] },
      topics: ["tickets"],
      statedYears: [longText],
      limitations: [longText],
      evidence: [
        {
          quote: { start: 1, end: 3 },
          topics: ["tickets"],
          context: [],
          editionClues: [longText],
          uncertainty: longText,
        },
      ],
    });
    const bound = bindSelectedEvidence(
      "s1",
      page,
      output,
      "https://example.org/",
      segmentPage(page).spans,
    );
    expect(output.overview).toBe(longText);
    expect(output.coverage.found).toEqual([longText]);
    expect(output.coverage.notPublished).toEqual([longText]);
    expect(output.statedYears).toEqual([longText]);
    expect(bound.limitations).toEqual([longText]);
    expect(bound.evidence).toHaveLength(1);
    expect(bound.evidence[0]).toMatchObject({
      quote: page,
      editionClues: [longText],
      uncertainty: longText,
    });
  });

  it("recovers a complete segment range with links and conditions", () => {
    const passage =
      "## Festival passes 2027\n" +
      "Weekend admission and camping.\n".repeat(200) +
      "[Buy a pass](../tickets) for €100.\n" +
      "Includes tax. Children under 12 enter free with an adult.\n" +
      "* Mandatory booking fee: €5 per order.";
    const page = `🎪\nUnrelated text\n${passage}\nOther content`;
    const output = {
      limitations: [],
      evidence: [
        {
          quote: { start: 3, end: 206 },
          context: [],
          topics: ["tickets", "links"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    } satisfies Parameters<typeof bindSelectedEvidence>[2];
    const bound = bindSelectedEvidence(
      "s1",
      page,
      output,
      "https://example.org/info/",
      segmentPage(page).spans,
    );
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0].quote).toBe(passage);
    expect(
      page.slice(bound.evidence[0].span.start, bound.evidence[0].span.end),
    ).toBe(passage);
    expect(bound.evidence[0].anchors).toEqual([
      { url: "https://example.org/tickets", label: "Buy a pass" },
    ]);
  });

  it("binds an extra wire escape only to complete original text", () => {
    const quote = String.raw`## Passes 2027\nFull pass €100 \\+ handling fee €18.`;
    const page =
      "## Passes 2027\nFull pass €100 \\+ handling fee €18.\nConditions apply.";
    const bound = bindEvidence(
      "s1",
      page,
      { limitations: [], evidence: [{ quote, topics: ["tickets"] }] },
      "https://example.org/",
    );
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0].quote).toBe(
      page.split("\n").slice(0, 2).join("\n"),
    );
    const span = bound.evidence[0].span;
    expect(page.slice(span.start, span.end)).toBe(bound.evidence[0].quote);
  });

  it("preserves literal backslashes when the supplied text already matches", () => {
    const quote = String.raw`A literal \\+ sequence`;
    const bound = bindEvidence(
      "s1",
      quote,
      { limitations: [], evidence: [{ quote, topics: ["description"] }] },
      "https://example.org/",
    );
    expect(bound.evidence[0].quote).toBe(quote);
  });

  it("resolves reference links from restored literal context", () => {
    const bound = bindEvidence(
      "s1",
      "[Pass][buy]\n\n# 2027\n[buy]: /shop",
      {
        limitations: [],
        evidence: [
          {
            quote: "[Pass][buy]",
            topics: ["links"],
            context: [String.raw`# 2027\n[buy]: /shop`],
          },
        ],
      },
      "https://example.org/",
    );
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0].context[0].quote).toBe("# 2027\n[buy]: /shop");
    expect(bound.evidence[0].anchors).toEqual([
      { url: "https://example.org/shop", label: "Pass" },
    ]);
  });

  it.each([
    [
      "a repaired but invented price",
      "Pass €100.\nFee €5.",
      String.raw`Pass €110.\nFee €5.`,
    ],
    [
      "a repeated repaired quote",
      "Pass €100.\nFee €5.\nPass €100.\nFee €5.",
      String.raw`Pass €100.\nFee €5.`,
    ],
    [
      "a repeated original quote",
      String.raw`Fee \\+ €5. repeated: Fee \\+ €5. versus Fee \+ €5.`,
      String.raw`Fee \\+ €5.`,
    ],
  ])("rejects %s and keeps other evidence", (_name, body, quote) => {
    const bound = bindEvidence(
      "s1",
      `${body}\nA valid short quote`,
      {
        limitations: [],
        evidence: [
          { quote, topics: ["tickets"] },
          { quote: "A valid short quote", topics: ["tickets"] },
        ],
      },
      "https://example.org/",
    );
    expect(bound.limitations).toHaveLength(1);
    expect(bound.evidence).toHaveLength(1);
    expect(bound.evidence[0].quote).toBe("A valid short quote");
    expect(bound.evidence[0].id).toBe("s1-e2");
  });

  it("requires positive segment IDs and a strict range object", () => {
    const output = {
      overview: "A source page",
      coverage: { found: [], notPublished: [] },
      topics: [],
      statedYears: [],
      limitations: [],
      evidence: [
        {
          quote: { start: 1, end: 2 },
          context: [],
          topics: ["tickets"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    };
    for (const quote of [
      "A literal quote",
      { start: "Start", end: "End" },
      { start: 0, end: 2 },
      { start: 1, end: 2, extra: true },
    ]) {
      expect(
        readerSelectionSchema.safeParse({
          ...output,
          evidence: [{ ...output.evidence[0], quote }],
        }).success,
      ).toBe(false);
    }
  });

  it("derives only usable destinations from matched quotes and literal context", () => {
    const page =
      "Newsletter [Radio]()\n\n[Pass][buy]\n\n[buy]: ../shop?edition=2027";
    const bound = bindSelectedEvidence(
      "s1",
      page,
      {
        limitations: [],
        evidence: [
          {
            quote: { start: 1, end: 2 },
            context: [3],
            topics: ["links"],
            editionClues: ["2027"],
            uncertainty: null,
          },
        ],
      },
      "https://example.org/info/",
      segmentPage(page).spans,
    );
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
    const bound = bindEvidence(
      "s1",
      page,
      {
        limitations: [],
        evidence: [
          {
            quote: "| Full | €100 |\n| Day | €50 |",
            context: ["# 2027", "Includes tax."],
            topics: ["tickets", "description"],
            editionClues: ["2027"],
          },
          { quote: "Same", topics: ["tickets"] },
          { quote: "# 2027 Includes tax.", topics: ["tickets"] },
          {
            quote: "Includes tax.",
            context: ["Missing heading"],
            topics: ["tickets"],
          },
        ],
      },
      "https://example.org/",
    );
    expect(bound.evidence).toHaveLength(1);
    const item = bound.evidence[0];
    expect(page.slice(item.span.start, item.span.end)).toBe(item.quote);
    expect(item.span.start).toBeGreaterThan(80000);
    expect(item.context[0].span.start).toBe(3);
    expect(item.topics).toEqual(["tickets", "description"]);
    expect(bound.limitations).toHaveLength(3);
  });
  it("recovers the exact saved body and freezes the corpus", async () => {
    const root = await mkdtemp(join(tmpdir(), "eventroam-evidence-"));
    try {
      const store = createCorpusStorage("run-1", Date.now(), root);
      const body =
        "---\ntitle: Website claim\n---\n\n🎪 source\nFull pass €130.";
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
      await writeFile(source.markdownPath!, body + " Changed");
      await expect(readCanonicalSource(source)).rejects.toThrow(
        "hash mismatch",
      );
      expect(
        sourceArtifactRoot({ CATALOG_SOURCE_DIRECTORY: "data/private" }),
      ).toMatch(/eventroam\/data\/private$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("orders source folders by run start time and keeps same-time runs separate", async () => {
    const root = await mkdtemp(join(tmpdir(), "eventroam-evidence-"));
    try {
      const runs = [
        ["run-a", "2026-11-03T02:24:08.456Z"],
        ["run-z", "2026-11-03T02:19:21.123Z"],
        ["run-b", "2026-11-03T02:24:08.456Z"],
      ] as const;
      const folders = [
        "2026-11-03T02-24-08.456Z_run-a",
        "2026-11-03T02-19-21.123Z_run-z",
        "2026-11-03T02-24-08.456Z_run-b",
      ];
      for (const [index, [runId, startedAt]] of runs.entries()) {
        const store = createCorpusStorage(runId, Date.parse(startedAt), root);
        const source = await store.savePage({
          attemptedUrl: "https://example.org/",
          finalUrl: "https://example.org/",
          retrievedAt: "2026-11-03T03:00:00Z",
          method: "http",
          status: "ok",
          markdown: "# Festival",
        });
        await store.saveEvidence(source, []);
        const directory = join(root, folders[index], "sources");
        expect(source.markdownPath).toBe(join(directory, "s1.md"));
        expect(source.evidencePath).toBe(join(directory, "s1.evidence.json"));
        expect(await readCanonicalSource(source)).toBe("# Festival");
        const saved = JSON.parse(await readFile(source.evidencePath!, "utf8"));
        expect(saved.source.id).toBe("s1");
        expect(await readFile(source.markdownPath!, "utf8")).toContain(
          `"runId": "${runId}"`,
        );
      }
      expect((await readdir(root)).sort()).toEqual([
        folders[1],
        folders[0],
        folders[2],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
