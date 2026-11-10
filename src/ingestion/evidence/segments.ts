import type { Span } from "./contracts";

export type SegmentSelection = number | { start: number; end: number };

const segmentLimit = 2000;
const passageLimit = 24000;

export function segmentPage(body: string) {
  const spans: Span[] = [];
  for (const line of body.matchAll(/[^\r\n]+/g)) {
    if (!line[0].trim()) {
      continue;
    }
    let start = line.index;
    const end = start + line[0].length;
    while (end - start > segmentLimit) {
      const limit = start + segmentLimit;
      const space = body.slice(start, limit).lastIndexOf(" ");
      const cut =
        space > segmentLimit / 2
          ? start + space + 1
          : limit - Number(body.codePointAt(limit - 1)! > 0xffff);
      spans.push({ start, end: cut });
      start = cut;
    }
    spans.push({ start, end });
  }

  const parts: string[] = [];
  let end = 0;
  for (const [index, span] of spans.entries()) {
    const separator = index > 0 && span.start === end ? "\n" : "";
    parts.push(
      separator,
      body.slice(end, span.start),
      `${index + 1}|`,
      body.slice(span.start, span.end),
    );
    end = span.end;
  }
  parts.push(body.slice(end));
  return { spans, numbered: parts.join("") };
}

/** Select inclusive segment IDs within one canonical page. */
export function segmentSpan(
  spans: readonly Span[],
  selection: SegmentSelection,
): Span | null {
  const { start, end } =
    typeof selection === "number"
      ? { start: selection, end: selection }
      : selection;
  const first = spans[start - 1];
  const last = spans[end - 1];
  if (!first || !last || end < start || last.end - first.start > passageLimit) {
    return null;
  }
  return { start: first.start, end: last.end };
}
