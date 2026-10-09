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
      serviceTier: loadResearchConfig({
        NODE_ENV: "test",
        OPENROUTER_API_KEY: "test-key",
      }).serviceTier,
      reasoningEffort: "low",
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
  expect(request.reasoning).toEqual({ effort: "low" });
  expect(request.service_tier).toBe("flex");
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

test.each([true, false])(
  "add combines discovery and model usage (search details: %s)",
  async (searchDetails) => {
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
        options.budget.consumeSearch();
        options.budget.consumeModelCall();
        return {
          query,
          candidates: [{ url, title: "Provider Fest" }],
          retrievedAt: source.retrievedAt,
          modelCostUsd: searchDetails ? 0.125 : null,
          searchCostUsd: 0.25,
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
                name: "discoverSources",
                arguments: JSON.stringify({ query: "Provider Fest" }),
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
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
              cost: 0.125,
              prompt_tokens_details: { cached_tokens: 6 },
              completion_tokens_details: { reasoning_tokens: 12 },
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
        config: { ...config, limits: { ...config.limits, modelCalls: 4 } },
        discoverSources,
        readSource,
      },
    );
    expect(requests).toHaveLength(3);
    expect(
      requests.every((request) => request.service_tier === undefined),
    ).toBe(true);
    expect(discoverSources).toHaveBeenCalledTimes(1);
    expect(readSource).toHaveBeenCalledTimes(1);
    expect(result.usage).toMatchObject({
      searches: 1,
      pages: 1,
      modelCalls: 4,
      inputTokens: 37,
      outputTokens: 69,
      cachedInputTokens: searchDetails ? 20 : null,
      reasoningTokens: searchDetails ? 39 : null,
      modelCostUsd: searchDetails ? 0.5 : null,
      searchCostUsd: 0.25,
    });
    expect(requests[2].tools).toBeUndefined();
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
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
              ...(commentary === null
                ? {
                    prompt_tokens_details: { cached_tokens: 6 },
                    completion_tokens_details: { reasoning_tokens: 12 },
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
      commentary === null ? 12 : null,
    );
    expect(result.usage.reasoningTokens).toBe(commentary === null ? 24 : null);
    expect(requests[0].reasoning).toBeUndefined();
    expect(requests[0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({ name: "readSource" }),
        }),
      ]),
    );
    expect(readSource.mock.calls.map(([requestedUrl]) => requestedUrl)).toEqual(
      [url, linkedUrl],
    );
    expect(result.sources.map((read) => read.finalUrl)).toContain(linkedUrl);
    expect(result.errors).toEqual([]);
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
      config,
      readSource: async () => source,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("failed");
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "model_failed",
        stage: "research",
        diagnostic: expect.objectContaining({
          httpStatus: status,
          ...(status === 400 ? { providerCode: 1001 } : {}),
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
      modelCostUsd: 0.125,
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
