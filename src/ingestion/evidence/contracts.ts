import { z } from "zod";
import { pageLinks } from "./links";
import { ResearchLimitError } from "../runtime/budget";
import type { SourceReadMetadata } from "../tools/read-page/contracts";

export const topics = [
  "identity",
  "description",
  "dates",
  "status",
  "size",
  "tickets",
  "classification",
  "location",
  "links",
] as const;
const quote = z.string().min(1).max(24000);
export const readerOutputSchema = z.strictObject({
  overview: z.string().min(1).max(1500),
  topics: z.array(z.enum(topics)).max(9),
  statedYears: z.array(z.string().max(80)).max(100),
  limitations: z.array(z.string().max(500)).max(30),
  evidence: z
    .array(
      z.strictObject({
        quote: z.union([
          quote,
          z.strictObject({
            start: z.string().min(1).max(250),
            end: z.string().min(1).max(250),
          }),
        ]),
        context: z.array(quote).max(24),
        topics: z.array(z.enum(topics)).min(1).max(9),
        editionClues: z.array(z.string().max(250)).max(20),
        uncertainty: z.string().max(1000).nullable(),
      }),
    )
    .max(150),
});
export type ReaderOutput = z.infer<typeof readerOutputSchema>;
export type Span = { start: number; end: number };
export type Evidence = Omit<
  ReaderOutput["evidence"][number],
  "quote" | "context"
> & {
  quote: string;
  id: string;
  sourceId: string;
  span: Span;
  context: { quote: string; span: Span }[];
  anchors: { url: string; label: string }[];
};
export type Source = SourceReadMetadata & {
  id: string;
  contentHash?: string;
  markdownPath?: string;
  evidencePath?: string;
  processing: "unprocessed" | "complete" | "limited" | "failed";
  overview?: string;
  leads?: { url: string; label: string }[];
  topics?: ReaderOutput["topics"];
  statedYears?: string[];
  limitations: string[];
  readerResponse?: { text: string | null; object: unknown } | null;
};
export type FrozenCorpus = {
  version: string;
  sources: Source[];
  evidence: Evidence[];
};

/** The string index is a half-open UTF-16 offset, as used by String.slice. */
export function uniqueSpan(body: string, quote: string): Span | null {
  const start = body.indexOf(quote);
  if (start < 0 || body.indexOf(quote, start + 1) !== -1) {
    return null;
  }
  return { start, end: start + quote.length };
}

export function bindEvidence(
  sourceId: string,
  body: string,
  output: ReaderOutput,
  sourceUrl: string,
) {
  const evidence: Evidence[] = [];
  const limitations = [...output.limitations];
  for (const [index, item] of output.evidence.entries()) {
    let quote = typeof item.quote === "string" ? item.quote : null;
    if (typeof item.quote !== "string") {
      const start = uniqueSpan(body, item.quote.start);
      const end = uniqueSpan(body, item.quote.end);
      if (
        start &&
        end &&
        end.start >= start.end &&
        end.end - start.start <= 24000
      ) {
        quote = body.slice(start.start, end.end);
      }
    }
    const span = quote ? uniqueSpan(body, quote) : null;
    const context = item.context.map((quote) => ({
      quote,
      span: uniqueSpan(body, quote),
    }));
    if (!quote || !span || context.some((item) => !item.span)) {
      limitations.push(
        `Quotation ${index + 1} or its context has no unique literal match`,
      );
      continue;
    }
    const anchors = pageLinks([quote, ...item.context].join("\n\n"), sourceUrl);
    evidence.push({
      ...item,
      quote,
      anchors,
      id: `${sourceId}-e${index + 1}`,
      sourceId,
      span,
      context: context as Evidence["context"],
    });
  }
  return { evidence, limitations };
}

export function evidencePacket(
  corpus: FrozenCorpus,
  selected: readonly (typeof topics)[number][],
  options: { anchors?: boolean; maxCharacters?: number } = {},
) {
  const evidence = corpus.evidence.filter((item) =>
    item.topics.some((topic) => selected.includes(topic)),
  );
  const packet = {
    version: corpus.version,
    evidence: evidence.map((item) => {
      const source = corpus.sources.find(
        (source) => source.id === item.sourceId,
      )!;
      return {
        id: item.id,
        sourceId: item.sourceId,
        quote: item.quote,
        ...(item.context.length
          ? { context: item.context.map(({ quote }) => ({ quote })) }
          : {}),
        topics: item.topics,
        ...(item.editionClues.length
          ? { editionClues: item.editionClues }
          : {}),
        ...(item.uncertainty ? { uncertainty: item.uncertainty } : {}),
        ...(options.anchors && item.anchors.length
          ? { anchors: item.anchors }
          : {}),
        source: {
          finalUrl: source.finalUrl,
        },
      };
    }),
  };
  if (JSON.stringify(packet).length > (options.maxCharacters ?? 240000)) {
    throw new ResearchLimitError("context");
  }
  return packet;
}
