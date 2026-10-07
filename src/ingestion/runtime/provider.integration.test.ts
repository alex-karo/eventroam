import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { researchClaimSchema } from "../research/contracts";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { DEFAULT_RESEARCH_LIMITS } from "./budget";
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
  eventId,
  summary: null,
  eventName: "Provider Fest",
  editions: [
    {
      key: "2027",
      year: 2027,
      status: "announced",
    },
  ],
  claims: [],
  prices: [],
  links: [],
  observations: [],
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
                content: JSON.stringify(candidate),
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
    config: { ...config, reasoningEffort: "low", serviceTier: "flex" },
    readSource: async () => source,
  });
  expect(result.modelResponse).toEqual({
    text: JSON.stringify(candidate),
    object: candidate,
  });
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
    const claim = { editionKey: "2027", field: "scheduleStatus", value };
    const valid = ["announced", "scheduled", "postponed", "cancelled"].includes(
      String(value),
    );
    expect(researchClaimSchema.safeParse(claim).success).toBe(valid);
    expect(
      wireSchema.safeParse({ ...candidate, claims: [claim] }).success,
    ).toBe(valid);
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
                        content: JSON.stringify({
                          ...candidate,
                          eventId: null,
                        }),
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
                      content: JSON.stringify({ ...candidate, editions: [] }),
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
    expect(result.gaps).toEqual([]);
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
  expect(result.gaps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "invalid_candidate" }),
    ]),
  );
});

test("provider rejection has a safe outcome and never logs raw provider payloads", async () => {
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
      new Response(JSON.stringify({ error: { message: secret } }), {
        status: 400,
        headers: {
          "content-type": "application/json",
          "x-private-session": secret,
        },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await runCatalogResearch(input, {
    client,
    config,
    readSource: async () => source,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result.outcome).toBe("failed");
  expect(result.gaps).toContainEqual(
    expect.objectContaining({
      code: "model_failed",
      detail: "model_failed",
    }),
  );
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(JSON.stringify(written)).not.toContain(secret);
  expect(JSON.stringify(written)).not.toContain(config.apiKey);
  expect(
    (
      client.prepare("SELECT count(*) n FROM catalog_changes").get() as {
        n: number;
      }
    ).n,
  ).toBe(0);
});
