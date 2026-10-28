import { afterEach, expect, test, vi } from "vitest";

const { captureAi, constructor } = vi.hoisted(() => ({
  captureAi: vi.fn(),
  constructor: vi.fn(),
}));
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      constructor(...args);
    }
    captureAi = captureAi;
  },
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

test.each(["stalled", "failed"])(
  "search returns safe generation metrics with %s telemetry",
  async (delivery) => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-project");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://example.org");
    vi.stubEnv("CATALOG_TRACING", "true");
    captureAi.mockImplementation(() => {
      if (delivery === "failed") {
        throw new Error("PRIVATE_EXPORT_ERROR");
      }
      return new Promise(() => {});
    });
    const { searchWeb } = await import("../../tools/search-web/search");
    const { createResearchBudget } = await import("../budget");
    const budget = createResearchBudget({ durationMs: 1000 });
    const result = await searchWeb("PRIVATE_SEARCH_QUERY", {
      budget,
      config: {
        apiKey: "PRIVATE_PROVIDER_KEY",
        model: "provider/model",
        limits: budget.limits,
      },
      ai: { sessionId: "run-1", traceId: "trace-1", parentId: "parent-1" },
      fetch: vi.fn(async () =>
        Response.json({
          choices: [
            {
              message: {
                content: "PRIVATE_MODEL_REPLY",
                annotations: [
                  {
                    type: "url_citation",
                    url_citation: {
                      url: "https://festival.example/",
                      title: "Festival",
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 42, completion_tokens: 8 },
        }),
      ),
    });
    expect(result.candidates).toHaveLength(1);
    expect(captureAi).toHaveBeenCalledOnce();
    expect(captureAi.mock.calls[0]?.[0]).toMatchObject({
      event: "$ai_generation",
      properties: {
        $ai_trace_id: "trace-1",
        $ai_session_id: "run-1",
        $ai_parent_id: "parent-1",
        $ai_input_tokens: 42,
        $ai_output_tokens: 8,
      },
    });
    expect(JSON.stringify(captureAi.mock.calls)).not.toContain("PRIVATE_");
    expect(constructor).toHaveBeenCalledWith(
      "test-project",
      expect.objectContaining({
        requestTimeout: 1000,
        fetchRetryCount: 0,
      }),
    );
  },
);

test.each(["missing configuration", "tracing disabled"])(
  "%s does not create an ingestion PostHog client",
  async (scenario) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(
      "NEXT_PUBLIC_POSTHOG_KEY",
      scenario === "missing configuration" ? "" : "test-project",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_POSTHOG_HOST",
      scenario === "missing configuration" ? "" : "https://example.org",
    );
    vi.stubEnv(
      "CATALOG_TRACING",
      scenario === "tracing disabled" ? "false" : "true",
    );
    const { captureOpenRouterGeneration } = await import("./ai");
    captureOpenRouterGeneration({
      sessionId: "run-1",
      traceId: "trace-1",
      model: "provider/model",
      latencyMs: 1,
    });
    expect(constructor).not.toHaveBeenCalled();
    expect(captureAi).not.toHaveBeenCalled();
  },
);
