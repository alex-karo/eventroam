import { pageLinks } from "./links";
import { ResearchLimitError } from "../runtime/budget";
import type { SourceReadMetadata } from "../tools/read-page/contracts";
import type { ReaderEvidence, ReaderOutput } from "../roles/reader/contracts";
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
export type Span = { start: number; end: number };
export type Evidence = Omit<ReaderEvidence, "quote" | "context"> & {
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
  coverage?: ReaderOutput["coverage"];
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

/** Restore one extra wire escape only when the complete source text matches. */
export function literalMatch(body: string, supplied: string) {
  let quote = supplied;
  let span = uniqueSpan(body, quote);
  if (!span && !body.includes(supplied)) {
    quote = supplied
      .replace(/(?<!\\)\\n/g, "\n")
      .replace(/(?<!\\)\\\\([!-\/:-@[-`{-~])/g, (match, punctuation: string) =>
        punctuation === "\\" ? match : `\\${punctuation}`,
      );
    span = uniqueSpan(body, quote);
  }
  return { quote, span };
}

export function bindEvidence(
  sourceId: string,
  body: string,
  output: Pick<ReaderOutput, "evidence" | "limitations">,
  sourceUrl: string,
) {
  const evidence: Evidence[] = [];
  const limitations = [...output.limitations];
  for (const [index, supplied] of output.evidence.entries()) {
    if (!supplied.topics.length) {
      limitations.push(`Quotation ${index + 1} has no topic`);
      continue;
    }
    const item = {
      context: [],
      editionClues: [],
      uncertainty: null,
      ...supplied,
    };
    let quote =
      typeof item.quote === "string"
        ? literalMatch(body, item.quote).quote
        : null;
    if (typeof item.quote !== "string") {
      const opening = literalMatch(body, item.quote.start);
      const closing = literalMatch(body, item.quote.end);
      const start = opening.span;
      const end = closing.span;
      if (
        start &&
        end &&
        (end.start >= start.end || opening.quote.endsWith(closing.quote)) &&
        end.end - start.start <= 24000
      ) {
        quote = body.slice(start.start, end.end);
      }
    }
    const span = quote ? uniqueSpan(body, quote) : null;
    const context = item.context.map((quote) => literalMatch(body, quote));
    if (!quote || !span || context.some((item) => !item.span)) {
      limitations.push(
        `Quotation ${index + 1} or its context has no unique literal match`,
      );
      continue;
    }
    const anchors = pageLinks(
      [quote, ...context.map((part) => part.quote)].join("\n\n"),
      sourceUrl,
    );
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
export function requireSupport(
  ids: string[],
  corpus: FrozenCorpus,
  allowEmpty = false,
) {
  if (
    (!allowEmpty && !ids.length) ||
    ids.some((id) => !corpus.evidence.some((item) => item.id === id))
  ) {
    throw new Error("Missing or unknown evidence reference");
  }
}
