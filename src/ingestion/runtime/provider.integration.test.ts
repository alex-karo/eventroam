import { afterEach, expect, test, vi } from "vitest";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { invokeRole } from "../roles/invoke";
import { collectionOutputSchema } from "../roles/research/contracts";
import { createResearchBudget, DEFAULT_RESEARCH_LIMITS } from "./budget";
import { loadResearchConfig } from "./config";
import { sourceUrlSchema } from "../tools/contracts";
import { readerInstructions } from "../roles/reader/prompt";
import { readSource } from "../roles/reader/agent";

const config = {
  apiKey: "PRIVATE_TEST_KEY",
  model: "fixture/provider-model",
  limits: DEFAULT_RESEARCH_LIMITS,
};
const final = {
  checks: [
    { check: "identity", blocker: null, sourceIds: ["s1"] },
    {
      check: "currentTickets",
      sourceIds: ["s2"],
      blocker: "Ticket page is blocked.",
    },
  ],
  unresolved: [{ message: "Which official domain is correct?" }],
};
const usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 };
function response(
  message: Record<string, unknown>,
  providerUsage: unknown = usage,
) {
  return Response.json({
    id: "fixture",
    object: "chat.completion",
    created: 1,
    model: config.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", ...message },
        finish_reason: message.tool_calls ? "tool_calls" : "stop",
      },
    ],
    ...(providerUsage === undefined ? {} : { usage: providerUsage }),
  });
}
function toolCall(
  args: unknown = { url: "https://example.org/page" },
  commentary: string | null = null,
) {
  return {
    content: commentary,
    tool_calls: [
      {
        id: "inspect-step",
        type: "function",
        function: { name: "inspectPage", arguments: JSON.stringify(args) },
      },
    ],
  };
}
function inspector(
  execute = vi.fn(async () => ({ overview: "Compact page overview" })),
) {
  return {
    execute,
    tool: createTool({
      id: "inspectPage",
      description: "Inspect one page",
      inputSchema: z.strictObject({ url: sourceUrlSchema }),
      outputSchema: z.strictObject({ overview: z.string() }),
      execute,
    }),
  };
}
function run(
  options: {
    steps?: number;
    durationMs?: number;
    tools?: Parameters<typeof invokeRole>[0]["tools"];
    input?: unknown;
    signal?: AbortSignal;
  } = {},
) {
  const budget = createResearchBudget({
    ...config.limits,
    durationMs: options.durationMs ?? 30_000,
  });
  const pending = invokeRole({
    role: "research",
    version: "fixture",
    instructions: "Use only supplied sources",
    input: options.input ?? {},
    schema: collectionOutputSchema,
    config,
    budget,
    steps: options.steps ?? 1,
    tools: options.tools,
    signal: options.signal,
  });
  return { budget, pending };
}
function strictProblems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(strictProblems);
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const schema = value as Record<string, unknown>;
  const errors =
    schema.type === "object" &&
    schema.properties &&
    (schema.additionalProperties !== false ||
      JSON.stringify(Object.keys(schema.properties as object).sort()) !==
        JSON.stringify([...(schema.required as string[])].sort()))
      ? ["Non-strict object"]
      : [];
  return [...errors, ...Object.values(schema).flatMap(strictProblems)];
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test.each([
  { model: "fixture/provider-model", cacheInstructions: true },
  { model: "openai/gpt-6-luna", cacheInstructions: true },
  { model: "openai/gpt-4.1-mini", cacheInstructions: true },
  { model: "anthropic/claude-sonnet-4.6", cacheInstructions: true },
  { model: "opencode-go/gpt-6-luna", cacheInstructions: false },
])(
  "native Reader retains evidence and limits explicit caching to fixed instructions ($model)",
  async ({ model, cacheInstructions }) => {
    const output = {
      overview: "Admission offers",
      coverage: {
        found: ["Admission offers and concessions"],
        notPublished: [],
      },
      topics: ["tickets"],
      statedYears: ["2027"],
      limitations: [],
      evidence: [
        { quote: "Full pass €100.", topics: ["tickets"] },
        {
          quote: "Children enter free.",
          topics: ["tickets"],
          context: ["# 2027"],
          editionClues: [],
          uncertainty: null,
        },
      ],
    };
    let request: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        request = body;
        const schema = body.response_format.json_schema.schema;
        expect(strictProblems(schema)).toEqual([]);
        const variants = schema.properties.evidence.items.anyOf;
        expect(variants).toHaveLength(2);
        expect(variants[1].required).toEqual(["quote", "topics"]);
        return response({ content: JSON.stringify(output) });
      }),
    );
    for (const year of [2027, 2028]) {
      const input = {
        assignment: { requestedName: "Festival", currentDate: "2026-11-04" },
        source: { id: `s${year}`, finalUrl: `https://example.org/${year}` },
        page: `# ${year}\nFull pass €100.\nChildren enter free.`,
      };
      const result = await readSource({
        input,
        config: { ...config, model },
        budget: createResearchBudget(),
      });
      expect(result.status).toBe("success");
      expect(result.output).toEqual(output);
      expect(request.prompt_cache_options).toEqual(
        cacheInstructions ? { mode: "explicit" } : undefined,
      );
      expect(request.messages).toEqual([
        {
          role: cacheInstructions ? "system" : "developer",
          content: cacheInstructions
            ? [
                {
                  type: "text",
                  text: readerInstructions,
                  cache_control: { type: "ephemeral" },
                },
              ]
            : readerInstructions,
        },
        { role: "user", content: JSON.stringify(input) },
      ]);
    }
  },
);

test.each([
  { role: "research", cacheInstructions: undefined },
  { role: "research", cacheInstructions: true },
  { role: "reader", cacheInstructions: false },
] as const)(
  "native $role requests retain output settings and use caller cache setting $cacheInstructions",
  async ({ role, cacheInstructions }) => {
    const settings = loadResearchConfig({
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "fixture",
    });
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        expect(String(url)).toBe(
          "https://openrouter.ai/api/v1/chat/completions",
        );
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${config.apiKey}`,
        );
        requests.push(JSON.parse(String(init?.body)));
        return response({ content: JSON.stringify(final) });
      }),
    );
    const budget = createResearchBudget();
    const result = await invokeRole({
      role,
      version: "fixture",
      instructions: "Fixture",
      cacheInstructions,
      input: {},
      schema: collectionOutputSchema,
      config: {
        ...config,
        model: "openai/gpt-6-luna",
        serviceTier: settings.serviceTier,
        reasoningEffort: "medium",
      },
      budget,
    });
    expect(result.status).toBe("success");
    expect(result.output).toEqual(final);
    expect(result.modelResponse?.object).toEqual(final);
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request.model).toBe("openai/gpt-6-luna");
    expect(request.reasoning).toEqual({ effort: "medium" });
    expect(request.service_tier).toBe(settings.serviceTier);
    expect(request.prompt_cache_options).toEqual(
      cacheInstructions ? { mode: "explicit" } : undefined,
    );
    expect(request.messages).toEqual([
      {
        role: "system",
        content: [
          {
            type: "text",
            text: "Fixture",
            ...(cacheInstructions && {
              cache_control: { type: "ephemeral" },
            }),
          },
        ],
      },
      { role: "user", content: "{}" },
    ]);
    expect(request.cache_control).toBeUndefined();
    expect(request.tools).toBeUndefined();
    expect(request.stream).not.toBe(true);
    const schema = (
      request.response_format as {
        json_schema: { schema: Record<string, unknown> };
      }
    ).json_schema.schema;
    expect(strictProblems(schema)).toEqual([]);
    expect(schema.properties).not.toHaveProperty("status");
    expect(schema.properties).not.toHaveProperty("errors");
    expect(schema.properties).not.toHaveProperty("completionReason");
    expect(budget.snapshot().modelCalls).toBe(1);
  },
);

test.each([null, "I will inspect the linked page."])(
  "native tool calls with commentary %s retain history and reserve final output",
  async (commentary) => {
    const inspect = inspector();
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return response(
          requests.length === 1
            ? toolCall(undefined, commentary)
            : { content: JSON.stringify(final) },
        );
      }),
    );
    const { budget, pending } = run({
      steps: 2,
      tools: { inspectPage: inspect.tool },
    });
    expect((await pending).status).toBe("success");
    expect(inspect.execute).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
    expect(requests[0].tools).toBeDefined();
    expect(requests[1].tools).toBeUndefined();
    expect(JSON.stringify(requests[1].messages)).toContain(
      "Compact page overview",
    );
    expect(budget.snapshot().modelCalls).toBe(2);
  },
);

test.each([true, false])(
  "fifteenth ordinary step is reserved (final response %s)",
  async (returnsFinal) => {
    const inspect = inspector(
      vi.fn(async () => ({ overview: "x".repeat(80_000) })),
    );
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        const call = toolCall();
        call.tool_calls[0].id += requests.length;
        return response(
          requests.length === 15 && returnsFinal
            ? { content: JSON.stringify(final) }
            : call,
        );
      }),
    );
    const { budget, pending } = run({
      steps: 15,
      tools: { inspectPage: inspect.tool },
    });
    const result = await pending;
    expect(requests).toHaveLength(15);
    expect(budget.snapshot().modelCalls).toBe(15);
    expect(requests.slice(0, -1).every((request) => request.tools)).toBe(true);
    expect(requests.at(-1)?.tools).toBeUndefined();
    expect(JSON.stringify(requests.at(-1)?.messages).length).toBeGreaterThan(
      240_000,
    );
    expect(result.status).toBe(returnsFinal ? "success" : "failed");
    if (!returnsFinal) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "limit_reached" }),
      );
    }
  },
);

test.each([true, false])(
  "provider capacity retry preserves ordinary capacity (final response %s)",
  async (returnsFinal) => {
    const inspect = inspector();
    let requests = 0;
    const fetch = vi.fn(async () => {
      requests += 1;
      if (requests === 1) {
        return Response.json(
          {
            error: {
              message: "Private outage",
              metadata: { error_type: "provider_unavailable" },
            },
          },
          { status: 503 },
        );
      }
      return response(
        returnsFinal ? { content: JSON.stringify(final) } : toolCall(),
      );
    });
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const timer = vi.spyOn(globalThis, "setTimeout");
    const { budget, pending } = run({
      steps: returnsFinal ? 1 : 2,
      tools: { inspectPage: inspect.tool },
    });
    await vi.waitFor(() =>
      expect(timer.mock.calls.some(([, delay]) => delay === 10_000)).toBe(true),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(fetch).toHaveBeenCalledTimes(returnsFinal ? 2 : 3);
    expect(budget.snapshot().modelCalls).toBe(returnsFinal ? 2 : 3);
    expect(result.status).toBe(returnsFinal ? "success" : "failed");
    if (!returnsFinal) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "limit_reached" }),
      );
    }
  },
  15_000,
);

test.each([400, 429, 503])(
  "HTTP %i has safe diagnostics with no automatic retry",
  async (status) => {
    const secret = "PRIVATE_PROVIDER_PAYLOAD";
    const written: unknown[] = [];
    for (const method of ["error", "warn", "log", "info", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...parts) => {
        written.push(...parts);
      });
    }
    const fetch = vi.fn(async () =>
      Response.json(
        { error: { message: secret, code: 1001 } },
        { status, headers: { "x-private-session": secret } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await run().pending;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "model_failed",
        diagnostic: expect.objectContaining({
          httpStatus: status,
          providerCode: 1001,
          retryable: status === 429 || status === 503,
        }),
      }),
    );
    expect(JSON.stringify([result, written])).not.toContain(secret);
    expect(JSON.stringify([result, written])).not.toContain(config.apiKey);
  },
);

test.each(["http", "abort"])(
  "completed tool work survives later %s failure",
  async (failure) => {
    const inspect = inspector();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response(toolCall()))
      .mockImplementation(async (_url, init) => {
        if (failure === "http") {
          return Response.json(
            { error: { message: "Private failure" } },
            { status: 400 },
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(signal.reason);
          } else {
            signal?.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }
        });
      });
    vi.stubGlobal("fetch", fetch);
    const { budget, pending } = run({
      steps: 2,
      durationMs: failure === "abort" ? 500 : 30_000,
      tools: { inspectPage: inspect.tool },
    });
    const result = await pending;
    expect(inspect.execute).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(budget.snapshot().modelCalls).toBe(2);
    expect(result.status).toBe("failed");
    expect(result.errors[0].code).toBe(
      failure === "abort" ? "limit_reached" : "model_failed",
    );
  },
);

test.each([undefined, 0, 0.125])(
  "provider cost %s does not add report accounting",
  async (cost) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          { content: JSON.stringify(final) },
          { ...usage, ...(cost === undefined ? {} : { cost }) },
        ),
      ),
    );
    const result = await run().pending;
    expect(result.status).toBe("success");
    expect(result).not.toHaveProperty("usage");
  },
);

test.each(["Not JSON", JSON.stringify({ eventName: "Incomplete" })])(
  "invalid domain output is retained and fails: %s",
  async (content) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ content })),
    );
    const result = await run().pending;
    expect(result.status).toBe("failed");
    expect(result.modelResponse?.text).toBe(content);
    expect(result.errors[0].code).toBe("invalid_candidate");
  },
);

test("invalid tool arguments are not executed", async () => {
  const inspect = inspector();
  let requests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      response(
        ++requests === 1
          ? toolCall({ url: "ftp://example.org/private" })
          : { content: JSON.stringify(final) },
      ),
    ),
  );
  await run({ steps: 2, tools: { inspectPage: inspect.tool } }).pending;
  expect(inspect.execute).not.toHaveBeenCalled();
});

test("invalid tool output is rejected before it reaches the next model step", async () => {
  const inspect = inspector(
    vi.fn(async () => ({ overview: 1 as unknown as string })),
  );
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return response(
        requests.length === 1 ? toolCall() : { content: JSON.stringify(final) },
      );
    }),
  );
  await run({ steps: 2, tools: { inspectPage: inspect.tool } }).pending;
  expect(JSON.stringify(requests[1].messages)).toContain(
    "Tool output validation failed",
  );
});
