import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { noopObserve } from "@mastra/core/tools";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindEvidence,
  evidencePacket,
  readerOutputSchema,
  type Evidence,
} from "./contracts";
import { savedCitation } from "./repair";
import {
  createCorpusStorage,
  readCanonicalSource,
  sourceArtifactRoot,
} from "./storage";

describe("saved source evidence", () => {
  it("restores empty metadata for short items and retains required context for full items", () => {
    const page = "# 2027\nFull pass €100.\nChildren enter free.";
    const short = { quote: "Full pass €100.", topics: ["tickets"] };
    const full = {
      quote: "Children enter free.",
      topics: ["tickets"],
      context: ["# 2027"],
      editionClues: [],
      uncertainty: "Age limit is not stated.",
    };
    const output = readerOutputSchema.parse({
      overview: "Admission offers",
      coverage: { found: [], notPublished: [] },
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [short, full, { ...full, context: ["# Missing"] }],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/");
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
    const start = `Start ${"a".repeat(251)}`;
    const end = `End ${"b".repeat(251)}`;
    const page = `${start}\nFull pass €100.\n${end}`;
    const longText = "Source detail. ".repeat(150);
    const output = readerOutputSchema.parse({
      overview: longText,
      coverage: { found: [longText], notPublished: [longText] },
      topics: ["tickets"],
      statedYears: [longText],
      limitations: [longText],
      evidence: [
        {
          quote: { start, end },
          topics: ["tickets"],
          context: [],
          editionClues: [longText],
          uncertainty: longText,
        },
      ],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/");
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
      coverage: { found: [], notPublished: [] },
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
    String.raw`## Passes 2027\nFull pass €100 \\+ handling fee €18.`,
    {
      start: "## Passes 2027",
      end: String.raw`Full pass €100 \\+ handling fee €18.`,
    },
  ])(
    "binds an extra wire escape only to complete original text: %j",
    (quote) => {
      const page =
        "## Passes 2027\nFull pass €100 \\+ handling fee €18.\nConditions apply.";
      const output = readerOutputSchema.parse({
        overview: "Admission with a mandatory fee",
        coverage: { found: [], notPublished: [] },
        topics: ["tickets"],
        statedYears: ["2027"],
        limitations: [],
        evidence: [{ quote, topics: ["tickets"] }],
      });
      const bound = bindEvidence("s1", page, output, "https://example.org/");
      expect(bound.limitations).toEqual([]);
      expect(bound.evidence[0].quote).toBe(
        page.split("\n").slice(0, 2).join("\n"),
      );
      const span = bound.evidence[0].span;
      expect(page.slice(span.start, span.end)).toBe(bound.evidence[0].quote);
    },
  );

  it("preserves literal backslashes when the supplied text already matches", () => {
    const quote = String.raw`A literal \\+ sequence`;
    const output = readerOutputSchema.parse({
      overview: "A literal source sequence",
      coverage: { found: [], notPublished: [] },
      topics: ["description"],
      statedYears: [],
      limitations: [],
      evidence: [{ quote, topics: ["description"] }],
    });
    expect(
      bindEvidence("s1", quote, output, "https://example.org/").evidence[0]
        .quote,
    ).toBe(quote);
  });

  it("resolves reference links from restored literal context", () => {
    const output = readerOutputSchema.parse({
      overview: "A festival pass link",
      coverage: { found: [], notPublished: [] },
      topics: ["links"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        {
          quote: "[Pass][buy]",
          topics: ["links"],
          context: [String.raw`# 2027\n[buy]: /shop`],
          editionClues: [],
          uncertainty: null,
        },
      ],
    });
    const bound = bindEvidence(
      "s1",
      "[Pass][buy]\n\n# 2027\n[buy]: /shop",
      output,
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
      "identical boundaries",
      { start: "Full pass €100.", end: "Full pass €100." },
    ],
    ["a closing suffix", { start: "Full pass €100.", end: "€100." }],
  ])("accepts a complete literal opening with %s", (_name, quote) => {
    const page = "# 2027\nFull pass €100.\nOther content";
    const output = readerOutputSchema.parse({
      overview: "A festival pass",
      coverage: { found: [], notPublished: [] },
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        {
          quote,
          topics: ["tickets"],
          context: ["# 2027"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    });
    const bound = bindEvidence("s1", page, output, "https://example.org/");
    expect(bound.limitations).toEqual([]);
    expect(bound.evidence[0]).toMatchObject({
      quote: "Full pass €100.",
      context: [{ quote: "# 2027" }],
    });
    const span = bound.evidence[0].span;
    expect(page.slice(span.start, span.end)).toBe("Full pass €100.");
  });

  it.each([
    ["ambiguous start", "Start\nStart\nEnd", { start: "Start", end: "End" }],
    ["ambiguous end", "Start\nEnd\nEnd", { start: "Start", end: "End" }],
    ["missing boundary", "Start\nEnd", { start: "Absent", end: "End" }],
    ["reversed boundaries", "End\nStart", { start: "Start", end: "End" }],
    ["overlapping boundaries", "StartEnd", { start: "StartE", end: "tEnd" }],
    [
      "a repeated complete opening",
      "Pass €100.\nPass €100.",
      { start: "Pass €100.", end: "Pass €100." },
    ],
    ["an invented price", "Pass €100.", { start: "Pass €110.", end: "€110." }],
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
    [
      "a suffix over the limit",
      "x".repeat(24001),
      { start: "x".repeat(24001), end: "x".repeat(24001) },
    ],
    [
      "span over the limit",
      `Start${"x".repeat(24000)}End`,
      { start: "Start", end: "End" },
    ],
  ])("rejects %s and keeps other evidence", (_name, body, quote) => {
    const output = readerOutputSchema.parse({
      overview: "A source page",
      coverage: { found: [], notPublished: [] },
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

  it("requires nonempty literal boundaries and a strict boundary object", () => {
    const output = {
      overview: "A source page",
      coverage: { found: [], notPublished: [] },
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
      coverage: { found: [], notPublished: [] },
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
      coverage: { found: [], notPublished: [] },
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
  it("recovers the exact body and keeps repair citations separate from the frozen corpus", async () => {
    const root = await mkdtemp(join(tmpdir(), "eventroam-evidence-"));
    try {
      const store = createCorpusStorage("run-1", Date.now(), root);
      const quote = "[Official overview](https://example.org/tickets)";
      const body = `---\ntitle: Website claim\n---\n\n🎪 source\nRepeated row.\nRepeated row.\nFull pass €130.\nOne day between March 20–22, 2027\n${quote}`;
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
      const passages: Evidence[] = [];
      const cite = savedCitation(
        corpus,
        passages,
        new AbortController().signal,
      );
      const citeQuote = (quote: string) =>
        cite.execute!({ sourceId: source.id, quote }, { observe: noopObserve });
      expect(await citeQuote("Repeated row.")).toMatchObject({
        error:
          'quote matches more than once in the saved source. Text "Repeated row.".',
      });
      expect(await citeQuote("Full pass €140.")).toEqual({
        error:
          'quote has no literal match in the saved source. Text "Full pass €140.".',
      });
      expect(
        await cite.execute!(
          {
            sourceId: source.id,
            quote: "Full pass €130.",
            context: ["From March 20–22, 2027", "Repeated row."],
          },
          { observe: noopObserve },
        ),
      ).toEqual({
        error:
          'context[0] has no literal match in the saved source. Text "From March 20–22, 2027".\n' +
          'context[1] matches more than once in the saved source. Text "Repeated row.".',
      });
      expect(passages).toEqual([]);
      expect(await citeQuote(quote)).toEqual({
        evidenceId: "s1-repair-1",
        anchors: [
          { label: "Official overview", url: "https://example.org/tickets" },
        ],
      });
      expect(
        await cite.execute!(
          {
            sourceId: source.id,
            quote: "Full pass €130.",
            context: ["One day between March 20–22, 2027"],
          },
          { observe: noopObserve },
        ),
      ).toEqual({ evidenceId: "s1-repair-2", anchors: [] });
      expect(passages[1]).toMatchObject({
        quote: "Full pass €130.",
        context: [{ quote: "One day between March 20–22, 2027" }],
      });
      await writeFile(source.markdownPath!, body + " Changed");
      expect(await citeQuote(quote)).toEqual({
        error: "Saved source is unavailable or has changed",
      });
      expect(corpus.evidence).toEqual([]);
      expect(passages).toHaveLength(2);
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
