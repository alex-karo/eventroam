import type { ReadPageResult } from "./contracts";

function finalWordBoundary(text: string): number {
  let index = text.length - 1;
  while (index >= 0 && !/\s/.test(text[index])) {
    index -= 1;
  }
  if (index < 0) {
    return -1;
  }
  while (index >= 0 && /\s/.test(text[index])) {
    index -= 1;
  }
  return index + 1;
}

function linkDestinationEnd(
  markdown: string,
  cursor: number,
  end: number,
): number {
  let depth = 1;
  while (cursor < end && depth > 0) {
    if (markdown[cursor] === "\\") {
      cursor += 1;
    } else if (markdown[cursor] === "(") {
      depth += 1;
    } else if (markdown[cursor] === ")") {
      depth -= 1;
    }
    cursor += 1;
  }
  return depth === 0 ? cursor : -1;
}

function wholeLinkBoundary(markdown: string, end: number): number {
  // Track label brackets in order. Escaped brackets are label text.
  const labels: number[] = [];
  let cursor = 0;
  while (cursor < markdown.length) {
    const char = markdown[cursor];
    const position = cursor;
    cursor += 1;
    if (char === "\\") {
      cursor += 1;
      continue;
    }
    if (position >= end && labels.length === 0) {
      break;
    }
    if (char === "[") {
      labels.push(position);
      continue;
    }
    if (char !== "]") {
      continue;
    }
    const start = labels.pop();
    if (start === undefined || markdown[cursor] !== "(") {
      continue;
    }
    if (position >= end && start < end) {
      return start;
    }
    if (position >= end) {
      continue;
    }
    cursor = linkDestinationEnd(markdown, cursor + 1, end);
    if (cursor < 0) {
      return start;
    }
  }
  return end;
}

function boundMarkdown(
  markdown: string,
  maxChars: number,
): {
  markdown: string;
  truncated: boolean;
} {
  if (markdown.length <= maxChars) {
    return { markdown, truncated: false };
  }

  const prefix = markdown.slice(0, maxChars);
  // Keep the final paragraph, line, or word whole where possible. A page
  // without whitespace still retains a bounded prefix instead of vanishing.
  const paragraphEnd = prefix.lastIndexOf("\n\n");
  const lineEnd = prefix.lastIndexOf("\n");
  let end = finalWordBoundary(prefix);
  if (paragraphEnd > maxChars - 2_000) {
    end = paragraphEnd;
  } else if (lineEnd > maxChars - 2_000) {
    end = lineEnd;
  }
  if (end <= 0) {
    end = maxChars;
  }
  end = wholeLinkBoundary(markdown, end);
  const selected = prefix.slice(0, end);
  const commentStart = selected.lastIndexOf("<!--");
  if (commentStart > selected.lastIndexOf("-->")) {
    end = commentStart;
  }
  // A cut can fall inside the opening token itself.
  const token = /<(?:!|-|!-)?$/.exec(prefix.slice(0, end));
  if (token) {
    end -= token[0].length;
  }
  return { markdown: prefix.slice(0, end).trimEnd(), truncated: true };
}

export function boundedToolSource(read: ReadPageResult, maxChars = 80_000) {
  const markdownBudget = Math.max(1_000, maxChars - 300);
  return {
    url: read.finalUrl,
    status: read.status,
    ...boundMarkdown(read.markdown, markdownBudget),
    ...(read.reasonCode ? { reasonCode: read.reasonCode } : {}),
  };
}
