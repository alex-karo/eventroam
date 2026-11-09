import { pageLinks } from "./links";
import { segmentSpan } from "./segments";
import { ResearchLimitError } from "../runtime/budget";
import type { SourceReadMetadata } from "../tools/read-page/contracts";
import type {
  ReaderEvidence,
  ReaderSelectionOutput,
} from "../roles/reader/contracts";
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
  coverage?: ReaderSelectionOutput["coverage"];
  leads?: { url: string; label: string }[];
  topics?: ReaderSelectionOutput["topics"];
  statedYears?: string[];
  limitations: string[];
  readerResponse?: { text: string | null; object: unknown } | null;
};
export type FrozenCorpus = {
  version: string;
  sources: Source[];
  evidence: Evidence[];
};
type PageEvidence<Selection> = {
  evidence: {
    quote: Selection;
    context?: Selection[];
    topics: Evidence["topics"];
    editionClues?: string[];
    uncertainty?: string | null;
  }[];
  limitations: string[];
};

/** The string index is a half-open UTF-16 offset, as used by String.slice. */
function uniqueSpan(body: string, quote: string): Span | null {
  const start = body.indexOf(quote);
  if (start < 0 || body.indexOf(quote, start + 1) !== -1) {
    return null;
  }
  return { start, end: start + quote.length };
}

/** Bind quotations stored in fixed eval inputs. */
export function bindEvidence(
  sourceId: string,
  body: string,
  output: PageEvidence<string>,
  sourceUrl: string,
) {
  return bindPassages(
    sourceId,
    body,
    output,
    sourceUrl,
    (quote) => uniqueSpan(body, quote),
    "has no unique literal match",
  );
}

export function bindSelectedEvidence(
  sourceId: string,
  body: string,
  output: Pick<ReaderSelectionOutput, "evidence" | "limitations">,
  sourceUrl: string,
  segments: readonly Span[],
) {
  return bindPassages(
    sourceId,
    body,
    output,
    sourceUrl,
    (selection) => segmentSpan(segments, selection),
    "has an invalid segment selection",
  );
}

function bindPassages<Selection>(
  sourceId: string,
  body: string,
  output: PageEvidence<Selection>,
  sourceUrl: string,
  resolve: (selection: Selection) => Span | null,
  invalid: string,
) {
  const evidence: Evidence[] = [];
  const limitations = [...output.limitations];
  for (const [index, item] of output.evidence.entries()) {
    if (!item.topics.length) {
      limitations.push(`Quotation ${index + 1} has no topic`);
      continue;
    }
    const span = resolve(item.quote);
    const contextSpans = (item.context ?? []).map(resolve);
    if (!span || !contextSpans.every((part) => part !== null)) {
      limitations.push(`Quotation ${index + 1} or its context ${invalid}`);
      continue;
    }
    const quote = body.slice(span.start, span.end);
    const context = contextSpans.map((span) => ({
      quote: body.slice(span.start, span.end),
      span,
    }));
    const anchors = pageLinks(
      [quote, ...context.map((part) => part.quote)].join("\n\n"),
      sourceUrl,
    );
    evidence.push({
      quote,
      anchors,
      id: `${sourceId}-e${index + 1}`,
      sourceId,
      span,
      context,
      topics: item.topics,
      editionClues: item.editionClues ?? [],
      uncertainty: item.uncertainty ?? null,
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
