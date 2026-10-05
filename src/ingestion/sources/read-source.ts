import type { ResearchBudget } from "../runtime/budget";
import { ResearchLimitError } from "../runtime/budget";
import type { ReadSourceResult } from "./contracts";
import { extractSource } from "./extract";
import {
  getBoundedResponse,
  UnsafeSourceError,
  type BoundedResponse,
  type LookupHost,
} from "./network";

export interface ReadSourceOptions {
  budget: ResearchBudget;
  depth?: number;
  resolver?: LookupHost;
  request?: typeof getBoundedResponse;
  now?: () => Date;
}

function socialHost(hostname: string): boolean {
  return ["facebook.com", "instagram.com"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function baseResult(url: string, at: string): ReadSourceResult {
  return {
    attemptedUrl: url,
    finalUrl: url,
    retrievedAt: at,
    method: "http",
    outcome: "failed",
    markdown: "",
    links: [],
    completeness: "none",
  };
}

const SAFE_REQUEST_REASONS = new Set([
  "oversized_response",
  "timeout",
  "redirect_without_location",
  "redirect_limit",
  "unsafe_address",
  "unsafe_url",
  "invalid_url",
]);

function requestReason(error: unknown): string {
  if (error instanceof UnsafeSourceError) return error.message;
  if (error instanceof Error && SAFE_REQUEST_REASONS.has(error.message)) {
    return error.message;
  }
  return "request_failed";
}

export async function readSource(
  inputUrl: string,
  options: ReadSourceOptions,
): Promise<ReadSourceResult> {
  const at = (options.now?.() ?? new Date()).toISOString();
  const result = baseResult(inputUrl, at);
  try {
    options.budget.consumePage(options.depth);
  } catch (error) {
    if (error instanceof ResearchLimitError) {
      return {
        ...result,
        outcome: "blocked",
        reason: `${error.limit}_budget_exhausted`,
      };
    }
    throw error;
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("unsafe_url");
    }
  } catch {
    return { ...result, outcome: "blocked", reason: "invalid_url" };
  }
  if (socialHost(parsed.hostname)) {
    return {
      ...result,
      finalUrl: parsed.href,
      method: "social_stub",
      outcome: "unsupported",
      reason: "social_content_unsupported",
      links: [{ url: parsed.href, text: parsed.hostname }],
    };
  }

  let response: BoundedResponse;
  try {
    response = await (options.request ?? getBoundedResponse)(parsed.href, {
      maxBytes: options.budget.limits.pageBytes,
      timeoutMs: Math.min(15_000, options.budget.remaining().durationMs),
      resolver: options.resolver,
      onRetry: () => options.budget.consumePage(options.depth),
    });
  } catch (error) {
    return {
      ...result,
      outcome:
        error instanceof UnsafeSourceError ||
        error instanceof ResearchLimitError
          ? "blocked"
          : "failed",
      reason:
        error instanceof ResearchLimitError
          ? `${error.limit}_budget_exhausted`
          : requestReason(error),
    };
  }

  result.finalUrl = response.finalUrl;
  if (response.body.length > options.budget.limits.pageBytes) {
    return { ...result, outcome: "failed", reason: "oversized_response" };
  }
  if ([401, 403, 429].includes(response.status)) {
    return { ...result, outcome: "blocked", reason: `http_${response.status}` };
  }
  if (response.status < 200 || response.status >= 300) {
    return { ...result, outcome: "failed", reason: `http_${response.status}` };
  }
  const supported = [
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "application/json",
    "application/ld+json",
  ].some((type) => response.contentType.includes(type));
  if (!supported) {
    return {
      ...result,
      outcome: "unsupported",
      reason: "unsupported_media_type",
    };
  }
  const body = response.body.toString("utf8");
  const extracted = extractSource(
    body,
    response.finalUrl,
    response.contentType,
  );
  result.markdown = extracted.markdown;
  result.links = extracted.links;
  result.outcome = extracted.markdown ? "ok" : "partial";
  result.completeness =
    extracted.markdown && !extracted.truncated ? "full" : "partial";
  if (extracted.truncated) result.reason = "source_content_truncated";

  if (extracted.needsJavascript) {
    result.outcome = "partial";
    result.completeness = "partial";
    result.reason ??= "javascript_required";
  }
  return result;
}
