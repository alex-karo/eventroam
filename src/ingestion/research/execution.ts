import { ResearchLimitError } from "../runtime/budget";
export type ModelUsage = {
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  modelCostUsd: number | null;
};

export function updateModelUsage(
  usage: ModelUsage,
  step: {
    usage?: { inputTokens?: number; outputTokens?: number; raw?: unknown };
  },
): void {
  const input = step.usage?.inputTokens;
  const output = step.usage?.outputTokens;
  // OpenRouter synthesizes zero counts when usage is missing. Read the original
  // provider payload through Mastra's normalized usage envelopes.
  let raw = step.usage?.raw;
  while (raw && typeof raw === "object" && "raw" in raw) {
    raw = raw.raw;
  }
  const rawUsage = raw as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
      }
    | undefined;
  usage.complete &&=
    rawUsage?.prompt_tokens != null &&
    rawUsage?.completion_tokens != null &&
    input !== undefined &&
    output !== undefined;
  if (input === undefined && output === undefined) {
    usage.modelCostUsd = null;
    return;
  }
  usage.inputTokens += input ?? 0;
  usage.outputTokens += output ?? 0;
  const providerUsage = (
    step as {
      providerMetadata?: {
        openrouter?: {
          usage?: {
            cost?: number;
            promptTokensDetails?: { cachedTokens?: number };
            completionTokensDetails?: { reasoningTokens?: number };
          };
        };
      };
    }
  ).providerMetadata?.openrouter?.usage;
  // Provider details retain the difference between missing metrics and zero.
  const cached = providerUsage?.promptTokensDetails?.cachedTokens;
  const reasoning = providerUsage?.completionTokensDetails?.reasoningTokens;
  usage.cachedInputTokens =
    usage.cachedInputTokens !== null && cached !== undefined
      ? usage.cachedInputTokens + cached
      : null;
  usage.reasoningTokens =
    usage.reasoningTokens !== null && reasoning !== undefined
      ? usage.reasoningTokens + reasoning
      : null;
  const cost = providerUsage?.cost;
  usage.modelCostUsd =
    cost !== undefined && Number.isFinite(cost) && cost >= 0
      ? (usage.modelCostUsd ?? 0) + cost
      : null;
}

function serializedResearchLimit(item: Record<string, unknown>) {
  if (
    item.name === "ResearchLimitError" &&
    typeof item.limit === "string" &&
    [
      "time",
      "searches",
      "pages",
      "depth",
      "modelCalls",
      "modelInputChars",
    ].includes(item.limit)
  ) {
    return new ResearchLimitError(item.limit as ResearchLimitError["limit"]);
  }
  if (typeof item.message === "string") {
    const match =
      /^Research (time|searches|pages|depth|modelCalls|modelInputChars) limit exhausted$/.exec(
        item.message,
      );
    if (match) {
      return new ResearchLimitError(match[1] as ResearchLimitError["limit"]);
    }
  }
  return undefined;
}

export function classifyModelError(
  error: unknown,
  deadline: number,
  finishedAt = Date.now(),
) {
  const errorTypes: string[] = [];
  let httpStatus: number | undefined;
  let providerCode: { value: string | number } | undefined;
  let retryable: boolean | undefined;
  let limit: ResearchLimitError | undefined;
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 6 && current && !seen.has(current); depth++) {
    seen.add(current);
    if (current instanceof ResearchLimitError) {
      limit = current;
    }
    if (typeof current !== "object") {
      break;
    }
    const item = current as Record<string, unknown>;
    limit ??= serializedResearchLimit(item);
    if (typeof item.name === "string") {
      const name = safeErrorName(item.name);
      if (!errorTypes.includes(name)) {
        errorTypes.push(name);
      }
    }
    httpStatus ??= safeHttpStatus(item.statusCode);
    providerCode = chooseProviderCode(providerCode, item);
    retryable ??=
      typeof item.isRetryable === "boolean" ? item.isRetryable : undefined;
    current = item.cause;
  }
  if (!limit && finishedAt >= deadline) {
    limit = new ResearchLimitError("time");
  }
  return {
    limit,
    diagnostic: {
      errorTypes: errorTypes.length ? errorTypes : ["UnknownError"],
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      ...(providerCode !== undefined
        ? { providerCode: providerCode.value }
        : {}),
      ...(retryable !== undefined ? { retryable } : {}),
    },
  };
}

const knownErrorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "AbortError",
  "TimeoutError",
  "AggregateError",
  "APICallError",
  "AI_APICallError",
  "RetryError",
  "AI_RetryError",
  "NoObjectGeneratedError",
  "AI_NoObjectGeneratedError",
  "AI_JSONParseError",
  "AI_TypeValidationError",
  "AI_InvalidResponseDataError",
  "AI_EmptyResponseBodyError",
  "AI_NoContentGeneratedError",
  "AI_InvalidArgumentError",
  "AI_InvalidPromptError",
  "AI_LoadAPIKeyError",
  "AI_NoSuchModelError",
  "AI_UnsupportedFunctionalityError",
  "FetchError",
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "BodyTimeoutError",
]);

const knownProviderCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "invalid_request_error",
  "rate_limit_exceeded",
  "insufficient_quota",
  "server_error",
  "model_not_found",
  "context_length_exceeded",
  "authentication_error",
  "permission_error",
  "provider_error",
  "bad_request",
]);

function safeErrorName(value: string): string {
  return knownErrorNames.has(value) ? value : "UnknownError";
}

function safeHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value < 600
    ? value
    : undefined;
}

function chooseProviderCode(
  previous: { value: string | number } | undefined,
  item: Record<string, unknown>,
): { value: string | number } | undefined {
  if (previous !== undefined && previous.value !== "UnknownCode") {
    return previous;
  }
  const direct = safeProviderCode(item.code);
  const nested = safeProviderCode(providerResponseCode(item.data));
  return (
    [direct, nested].find(
      (entry) => entry !== undefined && entry.value !== "UnknownCode",
    ) ??
    direct ??
    nested ??
    previous
  );
}

function safeProviderCode(
  value: unknown,
): { value: string | number } | undefined {
  if (typeof value === "string") {
    return { value: knownProviderCodes.has(value) ? value : "UnknownCode" };
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 999_999
  ) {
    return { value };
  }
  return undefined;
}

function providerResponseCode(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const error = (data as Record<string, unknown>).error;
  if (!error || typeof error !== "object") {
    // OpenRouter's HTTP-200 error envelope is exposed as data directly.
    return (data as Record<string, unknown>).code;
  }
  return (error as Record<string, unknown>).code;
}

/** Fixture generators also obey the original deadline; late promises cannot block assembly. */
export async function awaitModelAbort<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let aborted: () => void = () => {};
  const interruption = new Promise<never>((_resolve, reject) => {
    aborted = () => reject(new ResearchLimitError("time"));
    signal.addEventListener("abort", aborted, { once: true });
  });
  try {
    return await Promise.race([pending, interruption]);
  } finally {
    signal.removeEventListener("abort", aborted);
  }
}
