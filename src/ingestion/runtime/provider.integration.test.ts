import { afterEach, expect, test, vi } from "vitest";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { researchCandidateSchema } from "../research/contracts";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { DEFAULT_RESEARCH_LIMITS } from "./budget";
import { loadResearchConfig } from "./config";
import { runFixtureResearch as executeResearch } from "@/test/ingestion";

const runCatalogResearch: typeof executeResearch = async (input, deps) => {
  const result = await executeResearch(input, deps);
  const row = deps.client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(result.runId) as Record<string, unknown>;
  expect(JSON.parse(row.report_json as string)).toEqual(result);

  return result;
};
import type { ReadPageResult } from "../tools/read-page/contracts";

const url = "https://example.org/provider-fixture";
const eventId = "provider-fest";
const source: ReadPageResult = {
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-03T12:00:00.000Z",
  method: "http",
  status: "ok",
  markdown:
    "Provider Fest 2027 takes place in Portugal.\n\nWelcome to our festival, Provider Fest.",
};
const candidate = {
  status: "success",
  data: {
    eventId,
    eventName: "Provider Fest",
    sources: [],
    links: { socials: {} },
    previousEdition: null,
    currentOrNextEdition: {
      key: "2027",
      year: { value: 2027, reason: "Shown on the official page." },
      links: {},
    },
  },
  errors: [],
  unresolved: [],
};
const config = {
  apiKey: "test-provider-key",
  model: "fixture/provider-model",
  limits: {
    ...DEFAULT_RESEARCH_LIMITS,
    agentSteps: 1,
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
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("workflow captures the agent-visible initial source and tool responses", async () => {
  const client = testDatabase().client;
  savedSource(client);
  vi.stubEnv("CATALOG_CAPTURE_TOOL_OUTPUTS", "true");
  const linkedUrl = "https://example.org/linked-page";
  const requests: Record<string, unknown>[] = [];
  const directory = join(process.cwd(), "data", "catalog-debug");
  const readPage = vi.fn(
    async (
      requestedUrl: string,
      options: { budget: { consumePage: () => void } },
    ) => {
      options.budget.consumePage();
      return {
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
        markdown:
          requestedUrl === url ? source.markdown : "Linked page details",
      };
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(request);
      const step = requests.length;
      const message =
        step === 1
          ? {
              content: null,
              tool_calls: [
                {
                  id: "search-1",
                  type: "function",
                  function: {
                    name: "searchWeb",
                    arguments: JSON.stringify({ query: "Provider Fest" }),
                  },
                },
              ],
            }
          : step === 2
            ? {
                content: null,
                tool_calls: [
                  {
                    id: "read-2",
                    type: "function",
                    function: {
                      name: "readPage",
                      arguments: JSON.stringify({ url: linkedUrl }),
                    },
                  },
                ],
              }
            : {
                content: JSON.stringify(
                  wireCandidate(request, {
                    ...candidate,
                    data: {
                      ...candidate.data,
                      previousEdition: null,
                      currentOrNextEdition: null,
                    },
                  }),
                ),
              };
      return modelResponse(message);
    }),
  );

  try {
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, agentSteps: 4 } },
      readPage,
      searchWeb: async (query, options) => {
        options.budget.consumeSearch();
        return {
          query,
          candidates: [
            { url: linkedUrl, title: "Linked page", highlights: [] },
          ],
          retrievedAt: source.retrievedAt,
          inputTokens: 0,
          outputTokens: 0,
        };
      },
    });
    expect(result.researchStatus).toBe("success");
    expect(requests).toHaveLength(3);
    expect(readPage).toHaveBeenCalledTimes(2);
    if (!result.runId) {
      throw new Error("Expected a durable ingestion run");
    }
    const runDirectory = join(directory, result.runId);
    const files = readdirSync(runDirectory);
    expect(files.filter((file) => file.endsWith(".json"))).toEqual([
      "00001-initial-source.json",
      "00002-searchWeb.json",
      "00003-readPage.json",
    ]);
    const captured = files
      .filter((file) => file.endsWith(".json"))
      .map(
        (file) =>
          JSON.parse(readFileSync(join(runDirectory, file), "utf8")) as {
            runId: string;
            origin: string;
            result: Record<string, unknown>;
          },
      );
    expect(captured.every((record) => record.runId === result.runId)).toBe(
      true,
    );
    expect(captured.map((record) => record.origin)).toEqual([
      "initial-source",
      "searchWeb",
      "readPage",
    ]);
    expect(captured[0].result.markdown).toBe(source.markdown);
    expect(captured[1].result).toMatchObject({
      query: "Provider Fest",
      remaining: { searches: 2 },
    });
    expect(captured[2].result).toMatchObject({
      markdown: "Linked page details",
      remaining: { searches: 2 },
    });
    expect(readFileSync(join(runDirectory, "00003-readPage.md"), "utf8")).toBe(
      "Linked page details",
    );
    expect(JSON.stringify(result)).not.toContain("Linked page details");
  } finally {
    const ids = client.prepare("SELECT id FROM ingestion_runs").all() as {
      id: string;
    }[];
    for (const { id } of ids) {
      rmSync(join(directory, id), { recursive: true, force: true });
    }
  }
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
    readPage: async () => source,
  });
  expect(result.modelResponse?.object).toEqual(
    wireCandidate(requests[0], candidate),
  );
  expect(requests).toHaveLength(1);
  expect(result.budget.modelCalls).toBe(3);
  expect(result.researchStatus).toBe("success");
  expect(result.errors).toEqual([]);
  expect(result.operations.map((operation) => operation.kind)).toContain(
    "createEdition",
  );
  const request = requests[0];
  expect(request.model).toBe("openai/gpt-6-luna");
  expect(request.reasoning).toEqual({ effort: "medium" });
  expect(request.service_tier).toBe("flex");
  expect(request.extraBody).toBeUndefined();
  expect(request.stream).not.toBe(true);

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
        previousEdition: null,
        currentOrNextEdition: {
          ...candidate.data.currentOrNextEdition!,
          scheduleStatus: { value, reason: "Official schedule." },
        },
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
  "add shares discovery and model budgets (search details: %s; attempts: %s)",
  async (searchDetails, searchAttempts) => {
    const client = testDatabase().client;
    const requests: Record<string, unknown>[] = [];
    const readPage = vi.fn(
      async (
        requestedUrl: string,
        options: {
          budget: { consumePage: () => void };
        },
      ) => {
        options.budget.consumePage();
        return {
          ...source,
          attemptedUrl: requestedUrl,
          finalUrl: requestedUrl,
        };
      },
    );
    const searchWeb = vi.fn(
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
          candidates: [{ url, title: "Provider Fest", highlights: [] }],
          retrievedAt: source.retrievedAt,
          inputTokens: 7,
          outputTokens: 9,
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
                name: "searchWeb",
                arguments: JSON.stringify({ query: "  Provider Fest  " }),
              }
            : { name: "readPage", arguments: JSON.stringify({ url }) };
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
          limits: { ...config.limits, agentSteps: 3 + searchAttempts },
        },
        searchWeb,
        readPage,
      },
    );
    expect(requests).toHaveLength(3);
    expect(
      requests.every((request) => request.service_tier === undefined),
    ).toBe(true);
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(searchWeb).toHaveBeenCalledWith("Provider Fest", expect.anything());
    expect(readPage).toHaveBeenCalledTimes(1);

    expect(requests[2].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({ name: "readPage" }),
        }),
      ]),
    );
    expect(requests[0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({
            name: "searchWeb",
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
    const readPage = vi.fn(async (requestedUrl: string) => ({
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
                            name: "readPage",
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
                          data: {
                            ...candidate.data,
                            previousEdition: null,
                            currentOrNextEdition: null,
                          },
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
      config: { ...config, limits: { ...config.limits, agentSteps: 2 } },
      readPage,
    });
    expect(requests).toHaveLength(2);

    expect(requests[0].reasoning).toBeUndefined();
    expect(requests[0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({ name: "readPage" }),
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
    ).find((tool) => tool.function.name === "readPage");
    expect(readTool?.function.parameters.properties.url).toMatchObject({
      type: "string",
      pattern: "^https?:\\/\\/",
      description: expect.any(String),
    });
    expect(readPage.mock.calls.map(([requestedUrl]) => requestedUrl)).toEqual([
      url,
      linkedUrl,
    ]);
    expect(result.sources.map((read) => read.finalUrl)).toContain(linkedUrl);
    expect(result.errors).toEqual([]);
    expect(result.researchStatus).toBe("success");
    expect(result).not.toHaveProperty("refresh");
    expect(
      (requests[0].tools as Array<{ function: { name: string } }>)
        .map((t) => t.function.name)
        .sort(),
    ).toEqual(["readPage", "searchWeb"]);
    expect(requests[1].tools).toBeUndefined();
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

function readCall(
  args: Record<string, unknown> = { url: "https://example.org/linked-page" },
) {
  return {
    content: null,
    tool_calls: [
      {
        id: "read-step",
        type: "function",
        function: { name: "readPage", arguments: JSON.stringify(args) },
      },
    ],
  };
}

test.each(["http", "abort"])(
  "retains completed tool history and call counters after %s failure",
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
          agentSteps: 2,
          durationMs: failure === "abort" ? 500 : 30_000,
        },
      },
      readPage: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.budget.modelCalls).toBe(2);
    expect(result).not.toHaveProperty("usage");
    expect(result.operations).toEqual([]);
    if (failure === "abort") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "limit_reached", stage: "research" }),
      );
    }
  },
);

test.each([true, false])(
  "large accumulated context reaches the reserved fifteenth step (final response: %s)",
  async (returnsFinalResponse) => {
    const client = testDatabase().client;
    savedSource(client);
    const requests: Record<string, unknown>[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (request, init) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 15 && returnsFinalResponse) {
        return finalResponse(stepUsage)(request, init);
      }
      const call = readCall();
      call.tool_calls[0].id = `large-context-${requests.length}`;
      return modelResponse(call, stepUsage);
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...DEFAULT_RESEARCH_LIMITS } },
      readPage: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
        markdown: "x".repeat(80_000),
      }),
    });
    expect(requests).toHaveLength(15);
    expect(JSON.stringify(requests.at(-1)?.messages).length).toBeGreaterThan(
      240_000,
    );
    expect(requests.slice(0, -1).every((request) => request.tools)).toBe(true);
    expect(requests.at(-1)?.tools).toBeUndefined();
    expect(result.budget.modelCalls).toBe(returnsFinalResponse ? 17 : 15);
    expect(result.limits).not.toHaveProperty("modelInputChars");
    if (returnsFinalResponse) {
      expect(result.researchStatus).toBe("success");
      expect(result.errors).toEqual([]);
    } else {
      expect(result.operations).toEqual([]);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "limit_reached", stage: "research" }),
      );
    }
  },
);

test("native agent iterations stop repeated tool requests", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const fetchMock = vi.fn<typeof fetch>(async () =>
    modelResponse(readCall(), stepUsage),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await runCatalogResearch(input, {
    client,
    config: { ...config, limits: { ...config.limits, agentSteps: 2 } },
    readPage: async (requestedUrl) => ({
      ...source,
      attemptedUrl: requestedUrl,
      finalUrl: requestedUrl,
    }),
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.operations).toEqual([]);
  expect(result.budget.modelCalls).toBe(fetchMock.mock.calls.length);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "limit_reached", stage: "research" }),
  );
});

test("provider unavailable retries preserve ordinary agent capacity and call accounting", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        {
          error: {
            message: "Temporary provider outage",
            metadata: { error_type: "provider_unavailable" },
          },
        },
        { status: 503 },
      ),
    )
    .mockImplementation(finalResponse(stepUsage));
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const timer = vi.spyOn(globalThis, "setTimeout");
  const pending = runCatalogResearch(input, {
    client,
    config: { ...config, limits: { ...config.limits, durationMs: 30_000 } },
    readPage: async () => source,
  });
  // Wait for the SDK to schedule its real backoff, then advance only that delay.
  await vi.waitFor(() => {
    expect(timer.mock.calls.some(([, delay]) => delay === 10_000)).toBe(true);
  });
  await vi.advanceTimersByTimeAsync(10_000);
  const result = await pending;
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.budget.modelCalls).toBe(4);

  expect(result.errors).toEqual([]);
}, 15_000);

test("retry allowance cannot add ordinary agent iterations", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        {
          error: {
            message: "Temporary provider outage",
            metadata: { error_type: "provider_unavailable" },
          },
        },
        { status: 503 },
      ),
    )
    .mockImplementation(async () => modelResponse(readCall(), stepUsage));
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const timer = vi.spyOn(globalThis, "setTimeout");
  const pending = runCatalogResearch(input, {
    client,
    config: {
      ...config,
      limits: { ...config.limits, agentSteps: 2, durationMs: 30_000 },
    },
    readPage: async (requestedUrl) => ({
      ...source,
      attemptedUrl: requestedUrl,
      finalUrl: requestedUrl,
    }),
  });
  // Wait for the SDK to schedule its real backoff, then advance only that delay.
  await vi.waitFor(() => {
    expect(timer.mock.calls.some(([, delay]) => delay === 10_000)).toBe(true);
  });
  await vi.advanceTimersByTimeAsync(10_000);
  const result = await pending;
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result.budget.modelCalls).toBe(3);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "limit_reached" }),
  );
}, 15_000);

test.each([
  [0.125, 0.125],
  [undefined, undefined],
])(
  "provider costs %s and %s do not add report accounting",
  async (cost, finalCost) => {
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
        .mockImplementationOnce(
          finalResponse({ ...finalStepUsage, cost: finalCost }),
        ),
    );
    const result = await runCatalogResearch(input, {
      client,
      config: { ...config, limits: { ...config.limits, agentSteps: 2 } },
      readPage: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
      }),
    });

    expect(result.errors).toEqual([]);
    expect(result).not.toHaveProperty("usage");
  },
);

test.each([
  { usage: undefined, expectedStatus: "success" },
  { usage: {}, expectedStatus: "failed" },
])(
  "provider usage $usage has research status $expectedStatus without report accounting",
  async ({ usage, expectedStatus }) => {
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
      config: { ...config, limits: { ...config.limits, agentSteps: 2 } },
      readPage: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
      }),
    });
    expect(result.researchStatus).toBe(expectedStatus);
    if (expectedStatus === "failed") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "model_failed" }),
      );
    } else {
      expect(result.errors).toEqual([]);
    }
    expect(result).not.toHaveProperty("usage");
  },
);

test.each([
  ["readPage", { url: "ftp://example.org/page" }],
  ["searchWeb", { query: "ab" }],
] as const)(
  "does not execute %s with invalid arguments",
  async (name, args) => {
    const client = testDatabase().client;
    savedSource(client);
    const readPage = vi.fn(async () => source);
    const searchWeb = vi.fn();
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
      config: { ...config, limits: { ...config.limits, agentSteps: 3 } },
      readPage,
      searchWeb,
    });
    expect(readPage).toHaveBeenCalledTimes(1); // Only the host's initial read.
    expect(searchWeb).not.toHaveBeenCalled();
  },
);

test.each(["readPage", "searchWeb"])(
  "rejects invalid %s output before returning it to the model",
  async (name) => {
    const client = testDatabase().client;
    savedSource(client);
    const call = readCall(
      name === "readPage"
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
      config: { ...config, limits: { ...config.limits, agentSteps: 3 } },
      readPage: async (requestedUrl) => ({
        ...source,
        attemptedUrl: requestedUrl,
        finalUrl: requestedUrl,
        status: (requestedUrl === url
          ? "ok"
          : "invalid") as ReadPageResult["status"],
      }),
      searchWeb: async (query) => ({
        query,
        candidates: [
          { url: "ftp://example.org/page", title: "Invalid", highlights: [] },
        ],
        retrievedAt: source.retrievedAt,
        inputTokens: 0,
        outputTokens: 0,
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
    readPage: async () => source,
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
    readPage: async () => source,
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

test.each([400, 429, 503])(
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
      config: { ...config, limits: { ...config.limits, agentSteps: 3 } },
      readPage: async () => source,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("failed");

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

test("completed tool history survives a later provider failure", async () => {
  const client = testDatabase().client;
  savedSource(client);
  const linkedUrl = "https://example.org/dates";
  const readPage = vi.fn(async (requestedUrl: string) => ({
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
                      name: "readPage",
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
    config: { ...config, limits: { ...config.limits, agentSteps: 2 } },
    readPage,
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(readPage).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({
    outcome: "failed",
    operations: [],
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
