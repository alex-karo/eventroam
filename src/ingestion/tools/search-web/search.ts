import { setTimeout as retryDelay } from "node:timers/promises";
import { SpanType, type AnySpan } from "@mastra/core/observability";
import { captureOpenRouterGeneration } from "../../runtime/observability/ai";
import type { Diagnose } from "../../runtime/observability/diagnostics";
import type { ResearchLogger } from "../../runtime/logging";
import { ResearchLimitError, type ResearchBudget } from "../../runtime/budget";
import type { ResearchConfig } from "../../runtime/config";
import {
  searchQuerySchema,
  type SearchWebResult,
  type SourceCandidate,
} from "./contracts";

interface Citation {
  type?: unknown;
  url_citation?: { url?: unknown; title?: unknown; content?: unknown };
}

interface SearchResponse {
  error?: unknown;
  choices?: {
    error?: unknown;
    finish_reason?: unknown;
    message?: { annotations?: Citation[] };
  }[];
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    cost?: unknown;
  };
}

export interface SearchWebOptions {
  budget: ResearchBudget;
  config: Pick<
    ResearchConfig,
    "apiKey" | "model" | "serviceTier" | "reasoningEffort"
  >;
  fetch?: typeof fetch;
  now?: () => Date;
  log?: ResearchLogger;
  ai?: { sessionId?: string; traceId?: string; parentId?: string };
  tracing?: { parent: AnySpan; diagnose: Diagnose };
  signal?: AbortSignal;
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

function searchPrompt(query: string) {
  return `Find official festival/organizer pages and edition ticket links for: ${query}. Return only a short list of candidate links.`;
}

function requestSearch(
  query: string,
  maxResults: number,
  options: SearchWebOptions,
) {
  const timeout = AbortSignal.timeout(
    Math.min(20_000, options.budget.remaining().durationMs),
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
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
        messages: [{ role: "user", content: searchPrompt(query) }],
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
      const content = annotation.url_citation?.content;
      const excerpt =
        typeof content === "string" ? content.trim().slice(0, 2000) : "";
      candidates.push({
        url: url.href,
        highlights: excerpt ? [excerpt] : [],
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
  options: SearchWebOptions,
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
  if (options.signal) {
    await retryDelay(delay, undefined, { signal: options.signal });
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  options.budget.assertTime();
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function recordSearchUsage(
  data: SearchResponse,
  options: SearchWebOptions,
  startTime: Date,
) {
  const tracing = options.tracing;
  if (!tracing) {
    return;
  }
  const inputTokens = nonNegativeNumber(data.usage?.prompt_tokens);
  const outputTokens = nonNegativeNumber(data.usage?.completion_tokens);
  if (inputTokens === undefined && outputTokens === undefined) {
    return;
  }
  const cost = nonNegativeNumber(data.usage?.cost);
  try {
    tracing.parent
      .createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: "OpenRouter web search",
        startTime,
        attributes: {
          provider: "openrouter",
          model: options.config.model,
          usage: { inputTokens, outputTokens },
          ...(cost !== undefined && {
            costContext: {
              estimatedCost: cost,
              costUnit: "USD",
              costMetadata: {
                source: "provider_reported",
                sdkCostField: "usage.cost",
                scope: "query_total",
              },
            },
          }),
        },
      })
      .end();
  } catch {
    tracing.diagnose("trace_export_failed");
  }
}

function parseSearchResponse(value: unknown): SearchResponse {
  const data = value as SearchResponse;
  const choice = data?.choices?.[0];
  if (
    data?.error != null ||
    choice?.error != null ||
    choice?.finish_reason === "error"
  ) {
    throw new Error("search_provider_error");
  }
  if (
    !Array.isArray(data?.choices) ||
    !choice?.message ||
    typeof choice.message !== "object" ||
    Array.isArray(choice.message)
  ) {
    throw new Error("search_invalid_response");
  }
  return data;
}

export async function searchWeb(
  query: string,
  options: SearchWebOptions,
): Promise<SearchWebResult> {
  const startedAt = Date.now();
  const normalized = searchQuerySchema.parse(query);
  const maxResults = Math.min(options.budget.limits.searchResults, 20);
  options.budget.assertTime();
  if (maxResults === 0) {
    return {
      query: normalized,
      candidates: [],
      retrievedAt: (options.now?.() ?? new Date()).toISOString(),
    };
  }
  let data: SearchResponse | undefined;
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    options.signal?.throwIfAborted();
    options.budget.consumeSearch();
    options.budget.consumeModelCall();
    try {
      const startTime = new Date();
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
      data = parseSearchResponse(await boundedJson(response, 1024 * 1024));
      recordSearchUsage(data, options, startTime);
      break;
    } catch (error) {
      options.signal?.throwIfAborted();
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

  captureOpenRouterGeneration({
    sessionId: options.ai?.sessionId,
    traceId: options.ai?.traceId,
    parentId: options.ai?.parentId,
    model: options.config.model,
    inputTokens: nonNegativeNumber(data.usage?.prompt_tokens),
    outputTokens: nonNegativeNumber(data.usage?.completion_tokens),
    latencyMs: Date.now() - startedAt,
  });
  const candidates = sourceCandidates(data, maxResults);
  return {
    query: normalized,
    candidates,
    retrievedAt: (options.now?.() ?? new Date()).toISOString(),
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
