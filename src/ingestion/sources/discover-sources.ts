import type { ResearchLogger } from "../runtime/logging";
import { ResearchLimitError, type ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { DiscoverSourcesResult, SourceCandidate } from "./contracts";
import { searchQuerySchema } from "./tool-schemas";

interface Citation {
  type?: unknown;
  url_citation?: { url?: unknown; title?: unknown };
}

interface SearchResponse {
  choices?: { message?: { annotations?: Citation[] } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
    cost_details?: { upstream_inference_cost?: number | null };
  };
}

export interface DiscoverSourcesOptions {
  budget: ResearchBudget;
  config: ResearchConfig;
  fetch?: typeof fetch;
  now?: () => Date;
  log?: ResearchLogger;
}

async function boundedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  if (!response.body) {
    return response.json();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        throw new Error("search_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}

function requestSearch(
  query: string,
  maxResults: number,
  options: DiscoverSourcesOptions,
) {
  const signal = AbortSignal.timeout(
    Math.min(20_000, options.budget.remaining().durationMs),
  );
  return (options.fetch ?? fetch)(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.config.model,
        ...(options.config.serviceTier && {
          service_tier: options.config.serviceTier,
        }),
        ...(options.config.reasoningEffort && {
          reasoning: { effort: options.config.reasoningEffort },
        }),
        messages: [
          {
            role: "user",
            content: `Find official festival/organizer pages and edition ticket links for: ${query}. Return only a short list of candidate links.`,
          },
        ],
        plugins: [{ id: "web", engine: "exa", max_results: maxResults }],
        max_tokens: Math.min(500, options.budget.limits.modelOutputTokens),
      }),
      signal,
    },
  );
}

function sourceCandidates(
  data: SearchResponse,
  maxResults: number,
): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const annotations = data.choices?.[0]?.message?.annotations ?? [];
  for (const annotation of annotations) {
    if (annotation.type !== "url_citation") {
      continue;
    }
    const rawUrl = annotation.url_citation?.url;
    if (typeof rawUrl !== "string") {
      continue;
    }
    try {
      const url = new URL(rawUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        continue;
      }
      if (candidates.some((candidate) => candidate.url === url.href)) {
        continue;
      }
      candidates.push({
        url: url.href,
        title:
          typeof annotation.url_citation?.title === "string"
            ? annotation.url_citation.title.slice(0, 300)
            : url.hostname,
      });
      if (candidates.length >= maxResults) {
        break;
      }
    } catch {
      // Search citations are leads; discard malformed URLs.
    }
  }
  return candidates;
}

async function waitBeforeRetry(
  attempt: number,
  options: DiscoverSourcesOptions,
  retryAfter: string | null = null,
  httpStatus?: number,
): Promise<void> {
  const remaining = options.budget.remaining();
  if (remaining.searches === 0) {
    throw new ResearchLimitError("searches");
  }
  const now = (options.now?.() ?? new Date()).getTime();
  const seconds =
    retryAfter !== null && /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
      ? Number(retryAfter) * 1000
      : NaN;
  const retryAfterMs = Number.isFinite(seconds)
    ? seconds
    : Date.parse(retryAfter ?? "") - now;
  const delay = Math.max(
    500 * 2 ** attempt,
    Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
  );
  if (delay >= remaining.durationMs) {
    throw new ResearchLimitError("time");
  }
  options.log?.warn("Provider retry scheduled", {
    retryAttempt: attempt + 1,
    delayMs: delay,
    httpStatus,
    remaining,
  });
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  options.budget.assertTime();
}

export async function discoverSources(
  query: string,
  options: DiscoverSourcesOptions,
): Promise<DiscoverSourcesResult> {
  const normalized = searchQuerySchema.parse(query);
  const maxResults = Math.min(
    Math.max(1, options.budget.limits.searchResults),
    20,
  );
  let data: SearchResponse | undefined;
  let lastError: Error | undefined;
  let billedSearches = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    options.budget.consumeSearch();
    options.budget.consumeModelCall(normalized.length + 200);
    billedSearches += 1;
    try {
      const response = await requestSearch(normalized, maxResults, options);
      if (!response.ok) {
        const error = Object.assign(
          new Error(`search_http_${response.status}`),
          {
            statusCode: response.status,
          },
        );
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < 2
        ) {
          lastError = error;
          await response.body?.cancel();
          await waitBeforeRetry(
            attempt,
            options,
            response.headers.get("retry-after"),
            response.status,
          );
          continue;
        }
        throw error;
      }
      data = (await boundedJson(response, 1024 * 1024)) as SearchResponse;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("search_failed");
      if (
        attempt === 2 ||
        !["TimeoutError", "TypeError"].includes(lastError.name)
      ) {
        throw lastError;
      }
      await waitBeforeRetry(attempt, options);
    }
  }
  if (!data) {
    throw lastError ?? new Error("search_failed");
  }

  const candidates = sourceCandidates(data, maxResults);
  return {
    query: normalized,
    usageComplete:
      billedSearches === 1 &&
      typeof data.usage?.prompt_tokens === "number" &&
      typeof data.usage?.completion_tokens === "number",
    candidates,
    retrievedAt: (options.now?.() ?? new Date()).toISOString(),
    modelCostUsd:
      typeof data.usage?.cost_details?.upstream_inference_cost === "number" &&
      Number.isFinite(data.usage.cost_details.upstream_inference_cost) &&
      data.usage.cost_details.upstream_inference_cost >= 0
        ? data.usage.cost_details.upstream_inference_cost
        : null,
    searchCostUsd:
      billedSearches * (0.007 + Math.max(0, maxResults - 10) * 0.001),
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? null,
    reasoningTokens:
      data.usage?.completion_tokens_details?.reasoning_tokens ?? null,
  };
}

/** Read only the host-owned HTTP status; never copy exception messages/bodies. */
export function discoveryHttpStatus(error: unknown): number | undefined {
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? error.statusCode
      : undefined;
  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : undefined;
}
