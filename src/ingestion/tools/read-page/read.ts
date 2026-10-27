import type { ResearchLogger } from "../../runtime/logging";
import type { ResearchBudget } from "../../runtime/budget";
import { ResearchLimitError } from "../../runtime/budget";
import type { ReadPageResult } from "./contracts";
import { extractSource, MIN_RENDERED_TEXT_CHARS } from "./extract";
import {
  mergeMapReferences,
  referenceMarkdown,
  type MapReference,
} from "./maps";
import { myMapMarkdown, parseMyMap } from "./my-maps";
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
    status: "failed",
    markdown: "",
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
): Promise<MapReference[]> {
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
    return extracted.maps;
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
      return extracted.maps;
    }
    const rendered = extractSource(
      renderedResponse.body.toString("utf8"),
      renderedResponse.finalUrl,
      renderedResponse.contentType,
    );
    if (rendered.nonNavigationTextLength < MIN_RENDERED_TEXT_CHARS) {
      return extracted.maps;
    }
    const markdown = [
      rendered.markdown,
      extracted.markdown
        ? `## Direct HTTP response\n\n${extracted.markdown}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    result.finalUrl = renderedResponse.finalUrl;
    result.httpStatus = renderedResponse.status;
    result.method = "firecrawl";
    result.markdown = markdown;
    result.status = "ok";
    result.reasonCode = undefined;
    return mergeMapReferences(extracted.maps, rendered.maps);
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
  return extracted.maps;
}

async function appendMapEvidence(
  maps: MapReference[],
  result: ReadPageResult,
  options: ReadPageOptions,
): Promise<void> {
  for (const ref of maps) {
    let block = referenceMarkdown(ref);
    if (ref.mid) {
      try {
        options.budget.consumePage();
        const mapResponse = await (options.request ?? getBoundedResponse)(
          ref.url,
          {
            maxBytes: options.budget.limits.pageBytes,
            timeoutMs: Math.min(15_000, options.budget.remaining().durationMs),
            resolver: options.resolver,
            onRetry: () => options.budget.consumePage(),
          },
        );
        if (mapResponse.body.length > options.budget.limits.pageBytes) {
          throw new Error("oversized_response");
        }
        if (mapResponse.status < 200 || mapResponse.status >= 300) {
          throw new Error(`map_http_${mapResponse.status}`);
        }
        block += `\n\n${myMapMarkdown(parseMyMap(mapResponse.body.toString("utf8")))}`;
      } catch (error) {
        let reason = requestReason(error);
        if (error instanceof ResearchLimitError) {
          reason = `${error.limit}_budget_exhausted`;
        } else if (
          error instanceof Error &&
          /^(?:unsupported_map_data|map_http_\d+)$/.test(error.message)
        ) {
          reason = error.message;
        }
        block += `\n\nMap read incomplete: ${reason}. Point data is unverified.`;
        result.reasonCode ??= "map_read_incomplete";
      }
    }
    result.markdown += `\n\n${block}`;
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
        status: "failed",
        reasonCode: `${error.limit}_budget_exhausted`,
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
    return { ...result, status: "failed", reasonCode: "invalid_url" };
  }
  if (socialHost(parsed.hostname)) {
    return {
      ...result,
      finalUrl: parsed.href,
      method: "social_stub",
      status: "unsupported",
      reasonCode: "social_content_unsupported",
    };
  }

  let response: BoundedResponse;
  try {
    response = await fetchSource(parsed.href, options, result);
  } catch (error) {
    return {
      ...result,
      status: "failed",
      reasonCode:
        error instanceof ResearchLimitError
          ? `${error.limit}_budget_exhausted`
          : requestReason(error),
    };
  }

  result.finalUrl = response.finalUrl;
  result.httpStatus = response.status;
  if (response.body.length > options.budget.limits.pageBytes) {
    return { ...result, status: "failed", reasonCode: "oversized_response" };
  }
  if (response.status < 200 || response.status >= 300) {
    return {
      ...result,
      status: "failed",
      reasonCode: `http_${response.status}`,
    };
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
      status: "unsupported",
      reasonCode: "unsupported_media_type",
    };
  }
  const body = response.body.toString("utf8");
  const extracted = extractSource(
    body,
    response.finalUrl,
    response.contentType,
  );
  result.markdown = extracted.markdown;
  result.status = "ok";
  if (extracted.needsJavascript) {
    result.reasonCode = "javascript_required";
  }

  const maps = await tryRenderedFallback(response, extracted, result, options);
  await appendMapEvidence(maps, result, options);
  return result;
}
