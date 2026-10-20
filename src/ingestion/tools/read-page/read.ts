import type { ResearchLogger } from "../../runtime/logging";
import type { ResearchBudget } from "../../runtime/budget";
import { ResearchLimitError } from "../../runtime/budget";
import type { ReadPageResult } from "./contracts";
import {
  combineSourceExtractions,
  extractSource,
  MIN_RENDERED_TEXT_CHARS,
} from "./extract";
import { FirecrawlError, getFirecrawlResponse } from "./firecrawl";
import {
  getBoundedResponse,
  UnsafeSourceError,
  type BoundedResponse,
  type LookupHost,
} from "../network";

export interface ReadPageOptions {
  budget: ResearchBudget;
  resolver?: LookupHost;
  request?: typeof getBoundedResponse;
  firecrawlRequest?: typeof getFirecrawlResponse;
  firecrawlKey?: string;
  now?: () => Date;
  log?: ResearchLogger;
}

function socialHost(hostname: string): boolean {
  return ["facebook.com", "instagram.com"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function baseResult(url: string, at: string): ReadPageResult {
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
  if (error instanceof UnsafeSourceError) {
    return error.message;
  }
  if (error instanceof FirecrawlError) {
    return error.message;
  }
  if (error instanceof Error && SAFE_REQUEST_REASONS.has(error.message)) {
    return error.message;
  }
  return "request_failed";
}

function firecrawlKey(options: ReadPageOptions): string {
  return (options.firecrawlKey ?? process.env.FIRECRAWL_KEY)?.trim() ?? "";
}

async function fetchSource(
  url: string,
  options: ReadPageOptions,
  result: ReadPageResult,
): Promise<BoundedResponse> {
  const response = await (options.request ?? getBoundedResponse)(url, {
    maxBytes: options.budget.limits.pageBytes,
    timeoutMs: Math.min(15_000, options.budget.remaining().durationMs),
    resolver: options.resolver,
    onRetry: () => options.budget.consumePage(),
  });
  result.finalUrl = response.finalUrl;
  result.httpStatus = response.status;
  const apiKey = firecrawlKey(options);
  if (response.status !== 403 || !apiKey) {
    return response;
  }
  options.budget.consumePage();
  result.method = "firecrawl";
  options.log?.warn("Blocked source uses Firecrawl fallback", {
    attemptedUrl: response.finalUrl,
    httpStatus: 403,
    provider: "firecrawl",
  });
  return (options.firecrawlRequest ?? getFirecrawlResponse)(response.finalUrl, {
    apiKey,
    maxBytes: options.budget.limits.pageBytes,
    timeoutMs: Math.min(30_000, options.budget.remaining().durationMs),
    resolver: options.resolver,
  });
}

async function tryRenderedFallback(
  response: BoundedResponse,
  extracted: ReturnType<typeof extractSource>,
  result: ReadPageResult,
  options: ReadPageOptions,
): Promise<void> {
  const apiKey = firecrawlKey(options);
  if (
    result.method !== "http" ||
    response.status !== 200 ||
    (!response.contentType.includes("text/html") &&
      !response.contentType.includes("application/xhtml+xml")) ||
    !extracted.needsJavascript ||
    !apiKey ||
    options.budget.remaining().durationMs < 1_000
  ) {
    return;
  }

  try {
    options.budget.consumePage();
    const renderedResponse = await (
      options.firecrawlRequest ?? getFirecrawlResponse
    )(response.finalUrl, {
      apiKey,
      format: "html",
      maxBytes: options.budget.limits.pageBytes,
      timeoutMs: Math.min(30_000, options.budget.remaining().durationMs),
      resolver: options.resolver,
    });
    if (
      renderedResponse.status < 200 ||
      renderedResponse.status >= 300 ||
      renderedResponse.body.length > options.budget.limits.pageBytes
    ) {
      options.log?.warn("JavaScript source Firecrawl fallback failed", {
        attemptedUrl: response.finalUrl,
        provider: "firecrawl",
        errorCode:
          renderedResponse.body.length > options.budget.limits.pageBytes
            ? "oversized_response"
            : `firecrawl_page_http_${renderedResponse.status}`,
      });
      return;
    }
    const rendered = extractSource(
      renderedResponse.body.toString("utf8"),
      renderedResponse.finalUrl,
      renderedResponse.contentType,
    );
    if (rendered.nonNavigationTextLength < MIN_RENDERED_TEXT_CHARS) {
      return;
    }
    const combined = combineSourceExtractions(rendered, extracted);
    result.finalUrl = renderedResponse.finalUrl;
    result.httpStatus = renderedResponse.status;
    result.method = "firecrawl";
    result.markdown = combined.markdown;
    result.links = combined.links;
    result.sourceTruncated = combined.truncated;
    result.outcome = "ok";
    result.completeness = combined.truncated ? "partial" : "full";
    result.reason = combined.truncated ? "source_content_truncated" : undefined;
  } catch (error) {
    options.log?.warn("JavaScript source Firecrawl fallback failed", {
      attemptedUrl: response.finalUrl,
      provider: "firecrawl",
      errorCode:
        error instanceof ResearchLimitError
          ? `${error.limit}_budget_exhausted`
          : requestReason(error),
    });
  }
}

export async function readPage(
  inputUrl: string,
  options: ReadPageOptions,
): Promise<ReadPageResult> {
  const at = (options.now?.() ?? new Date()).toISOString();
  const result = baseResult(inputUrl, at);
  try {
    options.budget.consumePage();
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
      links: [parsed.href],
    };
  }

  let response: BoundedResponse;
  try {
    response = await fetchSource(parsed.href, options, result);
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
  result.httpStatus = response.status;
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
  result.sourceTruncated = extracted.truncated;
  result.markdown = extracted.markdown;
  result.links = extracted.links;
  result.outcome = extracted.markdown ? "ok" : "partial";
  result.completeness =
    extracted.markdown && !extracted.truncated ? "full" : "partial";
  if (extracted.truncated) {
    result.reason = "source_content_truncated";
  }

  if (extracted.needsJavascript) {
    result.outcome = "partial";
    result.completeness = "partial";
    result.reason ??= "javascript_required";
  }

  await tryRenderedFallback(response, extracted, result, options);
  return result;
}
