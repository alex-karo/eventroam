import type { ReadPageResult } from "./contracts";

function safeSource(read: ReadPageResult) {
  return {
    attemptedUrl: read.attemptedUrl,
    finalUrl: read.finalUrl,
    retrievedAt: read.retrievedAt,
    outcome: read.outcome,
    ...(read.reason ? { reason: read.reason } : {}),
  };
}

export function boundedToolSource(read: ReadPageResult, maxChars = 80_000) {
  const markdownBudget = Math.max(1_000, maxChars - 300);
  let markdown = read.markdown;
  if (markdown.length > markdownBudget) {
    const boundary = markdown.lastIndexOf("\n\n", markdownBudget);
    markdown = markdown.slice(0, boundary > 0 ? boundary : markdownBudget);
  }
  return {
    ...safeSource(read),
    markdown,
    truncated: markdown.length < read.markdown.length,
    completeness:
      markdown.length < read.markdown.length ? "partial" : read.completeness,
  };
}
