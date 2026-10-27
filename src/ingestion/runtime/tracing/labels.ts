/** A single byte limit, without splitting a Unicode code point. */
export function traceText(value: string, bytes: number) {
  const singleLine = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  if (Buffer.byteLength(singleLine) <= bytes) {
    return singleLine;
  }
  let result = "";
  for (const char of singleLine) {
    if (Buffer.byteLength(result + char + "…") > bytes) {
      break;
    }
    result += char;
  }
  return result + "…";
}
export function traceUrl(value: string) {
  return {
    url: traceText(value, 512),
    truncated: Buffer.byteLength(value) > 512,
  };
}
const reasons = new Set([
  "request_failed",
  "oversized_response",
  "invalid_url",
  "social_content_unsupported",
  "unsupported_media_type",
  "javascript_required",
  "unsafe_url",
  "unsafe_address",
  "redirect_limit",
  "redirect_missing_location",
  "request_timeout",
  "timeout",
  "redirect_without_location",
  "firecrawl_failed",
  "firecrawl_unavailable",
  "firecrawl_invalid_response",
]);
export function traceReason(reason?: string) {
  return reason &&
    (reasons.has(reason) ||
      /^(?:firecrawl_)?http_[1-5]\d\d$/.test(reason) ||
      /^(time|searches)_budget_exhausted$/.test(reason))
    ? traceText(reason, 64)
    : "unknown";
}
