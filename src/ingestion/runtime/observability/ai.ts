import { PostHog } from "posthog-node";

type OpenRouterGeneration = {
  sessionId?: string;
  traceId?: string;
  parentId?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
};

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

const posthog =
  process.env.CATALOG_TRACING === "true" && projectToken && host
    ? new PostHog(projectToken, {
        host,
        flushAt: 1,
        flushInterval: 0,
        requestTimeout: 1000,
        fetchRetryCount: 0,
        privacyMode: true,
        enableExceptionAutocapture: true,
      })
    : undefined;

export function captureOpenRouterGeneration(generation: OpenRouterGeneration) {
  const { sessionId, traceId } = generation;
  if (!posthog || !sessionId || !traceId) {
    return;
  }
  try {
    posthog.captureAi({
      distinctId: sessionId,
      event: "$ai_generation",
      properties: {
        $ai_trace_id: traceId,
        $ai_session_id: sessionId,
        ...(generation.parentId && { $ai_parent_id: generation.parentId }),
        $ai_span_name: "searchWeb",
        $ai_model: generation.model,
        $ai_provider: "openrouter",
        ...(generation.inputTokens !== undefined && {
          $ai_input_tokens: generation.inputTokens,
        }),
        ...(generation.outputTokens !== undefined && {
          $ai_output_tokens: generation.outputTokens,
        }),
        $ai_latency: generation.latencyMs / 1000,
      },
    });
  } catch {
    // AI observability must not change source discovery outcomes.
  }
}
