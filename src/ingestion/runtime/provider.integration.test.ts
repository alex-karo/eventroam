import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { researchCandidateSchema } from "../research/contracts";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { DEFAULT_RESEARCH_LIMITS } from "./budget";
import { loadResearchConfig } from "./config";
import { runCatalogResearch } from "../workflow";
import type { ReadSourceResult } from "../sources/contracts";

const url = "https://example.org/provider-fixture";
const eventId = "provider-fest";
const source: ReadSourceResult = {
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-03T12:00:00.000Z",
  method: "http",
  outcome: "ok",
  completeness: "full",
  markdown:
    "Provider Fest 2027 takes place in Portugal.\n\nWelcome to our festival, Provider Fest.",
  links: [],
};
const candidate = {
  status: "success",
  data: {
    eventId,
    eventName: "Provider Fest",
    sources: [],
    links: { socials: {} },
    editions: [
      {
        key: "2027",
        year: { value: 2027, reason: "Shown on the official page." },
        links: {},
      },
    ],
  },
  errors: [],
  unresolved: [],
};
const config = {
  apiKey: "test-provider-key",
  model: "fixture/provider-model",
  limits: {
    ...DEFAULT_RESEARCH_LIMITS,
    modelCalls: 1,
    modelOutputTokens: 256,
  },
};
const input = {
  mode: "refresh" as const,
  eventId,
  actor: "catalog-research",
  initiatedBy: "fixture-owner",
};

function wireCandidate(
  request: Record<string, unknown>,
  value: unknown,
): unknown {
  const root = (
    request.response_format as {
      json_schema: { schema: Record<string, unknown> };
    }
  ).json_schema.schema;
  const fill = (schema: Record<string, unknown>, part: unknown): unknown => {
    if (typeof schema.$ref === "string") {
      const ref = schema.$ref
        .replace(/^#\//, "")
        .split("/")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          root,
        );
      return fill(ref as Record<string, unknown>, part);
    }
    if (Array.isArray(schema.anyOf)) {
      if (part === null || part === undefined) {
        return null;
      }
      const branch = schema.anyOf.find(
        (item) => (item as Record<string, unknown>).type !== "null",
      );
      return fill(branch as Record<string, unknown>, part);
    }
    if (
      schema.type === "object" &&
      schema.properties &&
      typeof schema.properties === "object"
    ) {
      const fields = part as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(schema.properties).map(([key, child]) => [
          key,
          fields?.[key] === undefined
            ? null
            : fill(child as Record<string, unknown>, fields[key]),
        ]),
      );
    }
    if (schema.type === "array" && Array.isArray(part)) {
      return part.map((entry) =>
        fill(schema.items as Record<string, unknown>, entry),
      );
    }
    return part;
  };
  return fill(root, value);
}

function savedSource(client: ReturnType<typeof testDatabase>["client"]) {
  const fx = testFixtures(client);
  const event = fx.event({ id: eventId, canonicalName: "Provider Fest" });
  fx.eventLink(event, { url, kind: "official_site", official: true });
}

function strictSchemaProblems(value: unknown, path: string = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((part, index) =>
      strictSchemaProblems(part, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const node = value as Record<string, unknown>;
  const problems: string[] = [];
  for (const keyword of [
    "format",
    "pattern",
    "minLength",
    "maxLength",
    "oneOf",
  ]) {
    if (keyword in node) {
      problems.push(`${path}.${keyword}`);
    }
  }
  if (node.type === "object") {
    if (node.additionalProperties !== false) {
      problems.push(`${path}.additionalProperties`);
    }
    if ("propertyNames" in node) {
      problems.push(`${path}.propertyNames`);
    }
    if (node.properties && typeof node.properties === "object") {
      const properties = Object.keys(node.properties).sort();
      const required = Array.isArray(node.required)
        ? (node.required as string[]).sort()
        : [];
      if (JSON.stringify(required) !== JSON.stringify(properties)) {
        problems.push(`${path}.required`);
      }
    }
  }
  for (const [key, part] of Object.entries(node)) {
    problems.push(...strictSchemaProblems(part, `${path}.${key}`));
  }
  return problems;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("actual Mastra request sends a compatible bounded response schema", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      expect(String(_input)).toBe(
        "https://openrouter.ai/api/v1/chat/completions",
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Bearer ${config.apiKey}`,
      );
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          id: "fixture-completion",
          object: "chat.completion",
          created: 1,
          model: config.model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(wireCandidate(requests[0], candidate)),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            prompt_tokens_details: { cached_tokens: 6 },
            completion_tokens_details: { reasoning_tokens: 12 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  const result = await runCatalogResearch(input, {
    client,
    config: {
      ...config,
      model: "openai/gpt-6-luna",
      serviceTier: loadResearchConfig({
        NODE_ENV: "test",
        OPENROUTER_API_KEY: "test-key",
      }).serviceTier,
      reasoningEffort: "medium",
    },
    readSource: async () => source,
  });
  expect(result.modelResponse?.object).toEqual(
    wireCandidate(requests[0], candidate),
  );
  expect(requests).toHaveLength(1);
  expect(result.usage.modelCalls).toBe(1);
  expect(result.operations.map((operation) => operation.kind)).toContain(
    "createOccurrence",
  );
  const request = requests[0];
  expect(request.model).toBe("openai/gpt-6-luna");
  expect(request.reasoning).toEqual({ effort: "medium" });
  expect(request.service_tier).toBe("flex");
  expect(request.extraBody).toBeUndefined();
  expect(request.stream).not.toBe(true);
  expect(result.usage.cachedInputTokens).toBe(6);
  expect(result.usage.reasoningTokens).toBe(12);
  expect(request.plugins).toBeUndefined();
  expect(request.tools).toBeUndefined();
  expect(request.max_tokens ?? request.max_completion_tokens).toBe(256);
  const responseFormat = request.response_format as {
    type: string;
    json_schema: { schema: unknown };
  };
  expect(responseFormat.type).toBe("json_schema");
  expect(strictSchemaProblems(responseFormat.json_schema.schema)).toEqual([]);
  const responseProperties = (
    responseFormat.json_schema.schema as {
      properties: Record<string, { description?: string }>;
    }
  ).properties;
  expect(responseProperties.status.description).toContain(
    "Research completion",
  );
  expect(responseProperties.unresolved.description).toContain(
    "unfinished core check",
  );
  const wireSchema = z.fromJSONSchema(
    responseFormat.json_schema.schema as Parameters<typeof z.fromJSONSchema>[0],
  );
  for (const value of [
    "announced",
    "scheduled",
    "postponed",
    "cancelled",
    "completed",
    "unknown",
    null,
    1,
  ]) {
    const proposed = {
      ...candidate,
      data: {
        ...candidate.data,
        editions: [
          {
            ...candidate.data.editions[0],
            scheduleStatus: { value, reason: "Official schedule." },
          },
        ],
      },
    };
    const valid = ["announced", "scheduled", "postponed", "cancelled"].includes(
      String(value),
    );
    expect(researchCandidateSchema.safeParse(proposed).success).toBe(valid);
    expect(wireSchema.safeParse(wireCandidate(request, proposed)).success).toBe(
      valid,
    );
  }
});

test.each([
  [true, 1],
  [false, 1],
  [true, 2],
] as const)(
  "add combines discovery and model usage (search details: %s; attempts: %s)",
  async (searchDetails, searchAttempts) => {
    const client = testDatabase().client;
    const requests: Record<string, unknown>[] = [];
    const readSource = vi.fn(
      async (
        requestedUrl: string,
        options: {
          budget: { consumePage: (depth?: number) => void };
          depth?: number;
        },
      ) => {
        options.budget.consumePage(options.depth);
        return {
          ...source,
          attemptedUrl: requestedUrl,
          finalUrl: requestedUrl,
        };
      },
    );
    const discoverSources = vi.fn(
      async (
        query: string,
        options: {
          budget: { consumeSearch: () => void; consumeModelCall: () => void };
        },
      ) => {
        for (let attempt = 0; attempt < searchAttempts; attempt += 1) {
          options.budget.consumeSearch();
          options.budget.consumeModelCall();
        }
        return {
          query,
          candidates: [{ url, title: "Provider Fest" }],
          retrievedAt: source.retrievedAt,
          modelCostUsd: searchDetails ? 0.125 : null,
          searchCostUsd: 0.25,
          inputTokens: 7,
          outputTokens: 9,
          usageComplete: searchAttempts === 1,
          ...(searchDetails
            ? { cachedInputTokens: 2, reasoningTokens: 3 }
            : {}),
        };
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        requests.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        const step = requests.length;
        const toolCall =
          step === 1
            ? {
                name: "discoverSources",
                arguments: JSON.stringify({ query: "  Provider Fest  " }),
              }
            : { name: "readSource", arguments: JSON.stringify({ url }) };
        return new Response(
          JSON.stringify({
            id: `add-step-${step}`,
            object: "chat.completion",
            created: 1,
            model: config.model,
            choices: [
              {
                index: 0,
                message:
                  step < 3
                    ? {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                          {
                            id: `tool-${step}`,
                            type: "function",
                            function: toolCall,
                          },
                        ],
                      }
                    : {
                        role: "assistant",
                        content: JSON.stringify(
                          wireCandidate(requests[step - 1], {
                            ...candidate,
                            data: {
                              ...candidate.data,
                              eventId: null,
                              reason: "This is a distinct festival.",
                              summary: {
                                value: "A music festival.",
                                reason: "Official page describes it.",
                              },
                            },
                          }),
                        ),
                      },
                finish_reason: step < 3 ? "tool_calls" : "stop",
              },
            ],
            usage: {
              prompt_tokens: [10, 17, 31][step - 1],
              completion_tokens: [20, 29, 43][step - 1],
              total_tokens: [30, 46, 74][step - 1],
              cost: [0.125, 0.25, 0.5][step - 1],
              prompt_tokens_details: { cached_tokens: [6, 3, 10][step - 1] },
              completion_tokens_details: {
                reasoning_tokens: [12, 7, 15][step - 1],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const result = await runCatalogResearch(
      {
        mode: "add",
        name: "Provider Fest",
        actor: "catalog-research",
        initiatedBy: "fixture-owner",
      },
      {
        client,
        config: {
          ...config,
          limits: { ...config.limits, modelCalls: 3 + searchAttempts },
        },
        discoverSources,
        readSource,
      },
    );
    expect(requests).toHaveLength(3);
    expect(
      requests.every((request) => request.service_tier === undefined),
    ).toBe(true);
    expect(discoverSources).toHaveBeenCalledTimes(1);
    expect(discoverSources).toHaveBeenCalledWith(
      "Provider Fest",
      expect.anything(),
    );
    expect(readSource).toHaveBeenCalledTimes(1);
    expect(result.usage).toMatchObject({
      complete: searchAttempts === 1,
      searches: searchAttempts,
      pages: 1,
      modelCalls: 3 + searchAttempts,
      inputTokens: 65,
      outputTokens: 101,
      cachedInputTokens: searchDetails ? 21 : null,
      reasoningTokens: searchDetails ? 37 : null,
      modelCostUsd: searchDetails && searchAttempts === 1 ? 1 : null,
      searchCostUsd: 0.25,
    });
    expect(requests[2].tools).toBeUndefined();
    expect(requests[0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({
            name: "discoverSources",
            parameters: expect.objectContaining({
              properties: expect.objectContaining({
                query: expect.objectContaining({
                  minLength: 3,
                  maxLength: 300,
                  description: expect.any(String),
                }),
              }),
            }),
          }),
        }),
      ]),
    );
    expect(result.operations.map((operation) => operation.kind)).toContain(
      "createEvent",
    );
  },
);

test.each([null, "I will read the linked page before returning the result."])(
  "structured research follows tool calls with commentary %s",
  async (commentary) => {
    const client = testDatabase().client;
    savedSource(client);
    const linkedUrl = "https://example.org/dates";
    const requests: Record<string, unknown>[] = [];
    const readSource = vi.fn(async (requestedUrl: string) => ({
      ...source,
      attemptedUrl: requestedUrl,
      finalUrl: requestedUrl,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        requests.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        const toolCall = requests.length === 1;
        return new Response(
          JSON.stringify({
            id: `fixture-completion-${requests.length}`,
            object: "chat.completion",
            created: 1,
            model: config.model,
            choices: [
              {
                index: 0,
                message: toolCall
                  ? {
                      role: "assistant",
                      content: commentary,
                      tool_calls: [
                        {
                          id: "read-linked-page",
                          type: "function",
                          function: {
                            name: "readSource",
                            arguments: JSON.stringify({ url: linkedUrl }),
                          },
                        },
                      ],
                    }
                  : {
                      role: "assistant",
                      content: JSON.stringify(
                        wireCandidate(requests[requests.length - 1], {
                          ...candidate,
                          data: { ...candidate.data, editions: [] },
                        }),
                      ),
                    },
                finish_reason: toolCall ? "tool_calls" : "stop",
              },
            ],
            usage: {
              prompt_tokens: toolCall ? 10 : 23,
              completion_tokens: toolCall ? 20 : 37,
              total_tokens: toolCall ? 30 : 60,
              ...(commentary === null
                ? {
                    prompt_tokens_details: { cached_tokens: toolCall ? 6 : 4 },
                    completion_tokens_details: {
                      reasoning_tokens: toolCall ? 12 : 9,
                    },
                  }
                : {}),
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 2 } },
      readSource,
    });
    expect(requests).toHaveLength(2);
    expect(result.usage.cachedInputTokens).toBe(
      commentary === null ? 10 : null,
    );
    expect(result.usage.reasoningTokens).toBe(commentary === null ? 21 : null);
    expect(result.usage).toMatchObject({ inputTokens: 33, outputTokens: 57 });
    expect(requests[0].reasoning).toBeUndefined();
    expect(requests[0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({ name: "readSource" }),
        }),
      ]),
    );
    const readTool = (
      requests[0].tools as Array<{
        function: {
          name: string;
          parameters: { properties: { url: unknown } };
        };
      }>
    ).find((tool) => tool.function.name === "readSource");
    expect(readTool?.function.parameters.properties.url).toMatchObject({
      type: "string",
      pattern: "^https?:\\/\\/",
      description: expect.any(String),
    });
    expect(readSource.mock.calls.map(([requestedUrl]) => requestedUrl)).toEqual(
      [url, linkedUrl],
    );
    expect(result.sources.map((read) => read.finalUrl)).toContain(linkedUrl);
    expect(result.errors).toEqual([]);
  },
);

function modelResponse(
  message: Record<string, unknown>,
  usage?: Record<string, unknown>,
) {
  return Response.json({
    id: "usage-fixture",
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
    ...(usage && { usage }),
  });
}

function finalResponse(usage?: Record<string, unknown>): typeof fetch {
  return async (_input, init) =>
    modelResponse(
      {
        content: JSON.stringify(
          wireCandidate(JSON.parse(String(init?.body)), candidate),
        ),
      },
      usage,
    );
}

const stepUsage = {
  prompt_tokens: 10,
  completion_tokens: 20,
  total_tokens: 30,
  cost: 0,
  prompt_tokens_details: { cached_tokens: 6 },
  completion_tokens_details: { reasoning_tokens: 12 },
};

const finalStepUsage = {
  ...stepUsage,
  prompt_tokens: 23,
  completion_tokens: 37,
  total_tokens: 60,
  prompt_tokens_details: { cached_tokens: 4 },
  completion_tokens_details: { reasoning_tokens: 9 },
};

test.each(["standard", "flex"] as const)(
  "%s routing sends only the requested provider options",
  async (tier) => {
    const client = testDatabase().client;
    savedSource(client);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(finalResponse(stepUsage));
    vi.stubGlobal("fetch", fetchMock);
    const configured = loadResearchConfig({
      NODE_ENV: "test",
      OPENROUTER_API_KEY: config.apiKey,
      OPENROUTER_MODEL: "openai/gpt-6-luna",
      OPENROUTER_SERVICE_TIER: tier,
      OPENROUTER_REASONING_EFFORT: "medium",
    });
    const result = await runCatalogResearch(input, {
      client,
      config: { ...configured, limits: config.limits },
      readSource: async () => source,
    });
    expect(result.errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe("openai/gpt-6-luna");
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(Object.hasOwn(body, "service_tier")).toBe(tier === "flex");
    if (tier === "flex") {
      expect(body.service_tier).toBe("flex");
    }
    expect(body.extraBody).toBeUndefined();
    expect(body.plugins).toBeUndefined();
    expect(body.stream).not.toBe(true);
  },
);

test.each([true, false])(
  "zero token usage stays complete and preserves detail availability (%s)",
  async (details) => {
    const client = testDatabase().client;
    savedSource(client);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        finalResponse({
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
          ...(details
            ? {
                prompt_tokens_details: { cached_tokens: 0 },
                completion_tokens_details: { reasoning_tokens: 0 },
              }
            : {}),
        }),
      ),
    );
    const result = await runCatalogResearch(input, {
      client,
      config,
      readSource: async () => source,
    });
    expect(result.usage).toMatchObject({
      complete: true,
      inputTokens: 0,
      outputTokens: 0,
      modelCostUsd: 0,
      cachedInputTokens: details ? 0 : null,
      reasoningTokens: details ? 0 : null,
    });
    expect(result.errors).toEqual([]);
  },
);

function readCall(
  args: Record<string, unknown> = { url: "https://example.org/linked-page" },
) {
  return {
    content: null,
    tool_calls: [
      {
        id: "read-step",
        type: "function",
        function: { name: "readSource", arguments: JSON.stringify(args) },
      },
    ],
  };
}

test.each(["http", "abort", "context"])(
  "retains completed step usage after %s failure",
  async (failure) => {
    const client = testDatabase().client;
    savedSource(client);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        modelResponse(readCall(), { ...stepUsage, cost: 0.125 }),
      )
      .mockImplementation(async (_input, init) => {
        if (failure !== "abort") {
          return Response.json(
            { error: { message: "fixture failure" } },
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
    vi.stubGlobal("fetch", fetchMock);
    const result = await runCatalogResearch(input, {
      client,
      config: {
        ...config,
        limits: {
          ...config.limits,
          modelCalls: 2,
          durationMs: failure === "abort" ? 500 : 30_000,
          modelInputChars: failure === "context" ? 30_000 : 120_000,
        },
      },
      readSource: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
        markdown:
          failure === "context" && requestedUrl !== url
            ? "x".repeat(60_000)
            : source.markdown,
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(failure === "context" ? 1 : 2);
    expect(result.usage).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 6,
      reasoningTokens: 12,
      complete: false,
      modelCostUsd: null,
    });
    expect(result.operations).toEqual([]);
    if (failure === "context") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "limit_reached" }),
      );
    }
  },
);

test.each([undefined, 0, 0.125])(
  "keeps cost %s distinct from an unavailable total",
  async (cost) => {
    const client = testDatabase().client;
    savedSource(client);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          modelResponse(readCall(), {
            ...stepUsage,
            cost,
          }),
        )
        .mockImplementationOnce(finalResponse(finalStepUsage)),
    );
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 2 } },
      readSource: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
      }),
    });
    expect(result.usage).toMatchObject({
      complete: true,
      inputTokens: 33,
      outputTokens: 57,
      cachedInputTokens: 10,
      reasoningTokens: 21,
      modelCostUsd: cost ?? null,
    });
    expect(result.errors).toEqual([]);
  },
);

test.each([undefined, {}, { prompt_tokens: 0 }, { completion_tokens: 0 }])(
  "a final response without token counts (%s) preserves earlier tokens and marks the total partial",
  async (usage) => {
    const client = testDatabase().client;
    savedSource(client);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(modelResponse(readCall(), stepUsage))
        .mockImplementationOnce(finalResponse(usage)),
    );
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 2 } },
      readSource: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
      }),
    });
    expect(result.usage).toMatchObject({
      complete: false,
      inputTokens: 10,
      outputTokens: 20,
      modelCostUsd: null,
    });
  },
);

test.each([
  ["readSource", { url: "ftp://example.org/page" }],
  ["discoverSources", { query: "ab" }],
] as const)(
  "does not execute %s with invalid arguments",
  async (name, args) => {
    const client = testDatabase().client;
    savedSource(client);
    const readSource = vi.fn(async () => source);
    const discoverSources = vi.fn();
    const call = readCall(args);
    call.tool_calls[0].function.name = name;
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(modelResponse(call, stepUsage))
        .mockImplementationOnce(finalResponse(stepUsage)),
    );
    await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 3 } },
      readSource,
      discoverSources,
    });
    expect(readSource).toHaveBeenCalledTimes(1); // Only the host's initial read.
    expect(discoverSources).not.toHaveBeenCalled();
  },
);

test.each(["readSource", "discoverSources"])(
  "rejects invalid %s output before returning it to the model",
  async (name) => {
    const client = testDatabase().client;
    savedSource(client);
    const call = readCall(
      name === "readSource"
        ? { url: "https://example.org/linked-page" }
        : { query: "Provider Fest" },
    );
    call.tool_calls[0].function.name = name;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse(call, stepUsage))
      .mockImplementationOnce(finalResponse(stepUsage));
    vi.stubGlobal("fetch", fetchMock);
    await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 3 } },
      readSource: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
        completeness: (requestedUrl === url
          ? "full"
          : "invalid") as ReadSourceResult["completeness"],
      }),
      discoverSources: async (query) => ({
        query,
        candidates: [{ url: "ftp://example.org/page", title: "Invalid" }],
        retrievedAt: source.retrievedAt,
        inputTokens: 0,
        outputTokens: 0,
        modelCostUsd: null,
        searchCostUsd: 0,
      }),
    });
    const messages = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
      .messages as Array<{ role: string; content: string }>;
    expect(
      messages.find((message) => message.role === "tool")?.content,
    ).toContain("Tool output validation failed");
  },
);

test.each([
  "This is not a JSON candidate.",
  JSON.stringify({ eventName: "Incomplete" }),
])("invalid final output still cannot produce writes: %s", async (content) => {
  const client = testDatabase().client;
  savedSource(client);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "invalid-final",
            object: "chat.completion",
            created: 1,
            model: config.model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ),
  );
  const result = await runCatalogResearch(input, {
    client,
    config,
    readSource: async () => source,
  });
  expect(result.operations).toEqual([]);
  expect(result.receipts).toEqual([]);
  expect(result.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "invalid_candidate" }),
    ]),
  );
});

test("malformed final text at the deadline is retained in a failed research report", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const startedAt = Date.now();
  let clock = startedAt;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const content = "Final answer was malformed after the research deadline.";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      clock = startedAt + 1_000;
      return new Response(
        JSON.stringify({
          id: "late-invalid-final",
          object: "chat.completion",
          created: 1,
          model: config.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  const result = await runCatalogResearch(input, {
    client,
    config: { ...config, limits: { ...config.limits, durationMs: 1_000 } },
    readSource: async () => source,
  });
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "failed",
    operations: [],
    changes: [],
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "limit_reached", stage: "research" }),
  );
  expect(result.modelResponse).toEqual({ text: content, object: null });
});

test.each([200, 400, 429, 503])(
  "provider HTTP %i has safe diagnostics and no automatic retry",
  async (status) => {
    const client = testDatabase().client;
    savedSource(client);
    const secret = "PROVIDER_PRIVATE_SESSION_HEADER";
    const written: unknown[] = [];
    for (const name of ["error", "warn", "log", "info", "debug"] as const) {
      vi.spyOn(console, name).mockImplementation((...parts: unknown[]) => {
        written.push(...parts);
      });
    }
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: secret, code: 1001 } }),
          {
            status,
            headers: {
              "content-type": "application/json",
              "x-private-session": secret,
            },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, modelCalls: 3 } },
      readSource: async () => source,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("failed");
    expect(result.usage).toMatchObject({
      complete: false,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: null,
      reasoningTokens: null,
      modelCostUsd: null,
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "model_failed",
        stage: "research",
        diagnostic: expect.objectContaining({
          httpStatus: status,
          providerCode: 1001,
          retryable: status === 429 || status === 503,
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(config.apiKey);
    expect(JSON.stringify(written)).not.toContain(secret);
    expect(JSON.stringify(written)).not.toContain(config.apiKey);
    expect(
      (
        client.prepare("SELECT count(*) n FROM catalog_changes").get() as {
          n: number;
        }
      ).n,
    ).toBe(0);
  },
);

test("completed tool step usage survives a later provider failure", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const linkedUrl = "https://example.org/dates";
  const readSource = vi.fn(async (requestedUrl: string) => ({
    ...source,
    attemptedUrl: requestedUrl,
    finalUrl: requestedUrl,
  }));
  const fetchMock = vi.fn(async () => {
    if (fetchMock.mock.calls.length === 1) {
      return new Response(
        JSON.stringify({
          id: "successful-tool-step",
          object: "chat.completion",
          created: 1,
          model: config.model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "read-linked-page",
                    type: "function",
                    function: {
                      name: "readSource",
                      arguments: JSON.stringify({ url: linkedUrl }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            cost: 0.125,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: { message: "Unavailable" } }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await runCatalogResearch(input, {
    client,
    config: { ...config, limits: { ...config.limits, modelCalls: 2 } },
    readSource,
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(readSource).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({
    outcome: "failed",
    operations: [],
    usage: {
      modelCalls: 2,
      inputTokens: 10,
      outputTokens: 20,
      complete: false,
      modelCostUsd: null,
      cachedInputTokens: null,
      reasoningTokens: null,
    },
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "model_failed",
      diagnostic: expect.objectContaining({ httpStatus: 503 }),
    }),
  );
  expect(
    (
      client.prepare("SELECT count(*) n FROM catalog_changes").get() as {
        n: number;
      }
    ).n,
  ).toBe(0);
});
