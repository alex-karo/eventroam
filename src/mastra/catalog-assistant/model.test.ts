import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { createCatalogAssistant } from ".";
import { createChatMemory } from "./memory";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("inspection needs no key but default OpenRouter execution does", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const fetchModel = mockProvider();
  const chat = await createChatMemory(
    join(dirname(testDatabase().path), "chat.sqlite"),
  );
  const assistant = createCatalogAssistant({ createRun: vi.fn() }, chat.memory);
  try {
    await expect(assistant.getModel()).resolves.toBeDefined();
    await expect(
      assistant.generate("Hello", { modelSettings: { maxRetries: 0 } }),
    ).rejects.toThrow("OPENROUTER_API_KEY");
    expect(fetchModel).not.toHaveBeenCalled();
  } finally {
    await chat.memory.settled();
    await chat.storage.close();
  }
});

test.each([
  { model: undefined, effort: "high", tier: "flex", expectedTier: "flex" },
  {
    model: "openrouter/openai/gpt-6-luna" as const,
    effort: "low",
    tier: "standard",
    expectedTier: undefined,
  },
])(
  "OpenRouter chat sends configured options for $tier routing",
  async (settings) => {
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-openrouter");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
    vi.stubEnv("OPENROUTER_REASONING_EFFORT", settings.effort);
    vi.stubEnv("OPENROUTER_SERVICE_TIER", settings.tier);
    const fetchModel = mockProvider();
    const chat = await createChatMemory(
      join(dirname(testDatabase().path), "chat.sqlite"),
    );
    const assistant = createCatalogAssistant(
      { createRun: vi.fn() },
      chat.memory,
    );
    try {
      const result = await assistant.generate("Hello", {
        model: settings.model,
        modelSettings: { maxRetries: 0 },
      });
      expect(result.text).toBe("Ready.");
      expect(fetchModel).toHaveBeenCalledTimes(1);
      const [address, init] = fetchModel.mock.calls[0];
      expect(String(address)).toContain("openrouter.ai");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer fixture-openrouter",
      );
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "openai/gpt-6-luna",
        reasoning: { effort: settings.effort },
      });
      expect(JSON.parse(String(init?.body)).service_tier).toBe(
        settings.expectedTier,
      );
      await assistant.generate("Hello", {
        model: settings.model,
        providerOptions: {
          openrouter: {
            reasoning: { effort: "minimal" },
            service_tier: "priority",
          },
        },
        modelSettings: { maxRetries: 0 },
      });
      expect(
        JSON.parse(String(fetchModel.mock.calls[1][1]?.body)),
      ).toMatchObject({
        reasoning: { effort: "minimal" },
        service_tier: "priority",
      });
    } finally {
      await chat.memory.settled();
      await chat.storage.close();
    }
  },
);

test.each([
  {
    model: "openai/gpt-6-luna" as const,
    key: "OPENAI_API_KEY",
    host: "api.openai.com",
  },
  {
    model: "deepseek/deepseek-v4-flash" as const,
    key: "DEEPSEEK_API_KEY",
    host: "api.deepseek.com",
  },
])(
  "Studio can select $model without OpenRouter credentials",
  async ({ model, key, host }) => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_REASONING_EFFORT", "invalid-unused-setting");
    vi.stubEnv("OPENROUTER_SERVICE_TIER", "invalid-unused-setting");
    vi.stubEnv(key, "fixture-direct");
    const fetchModel = mockProvider();
    const chat = await createChatMemory(
      join(dirname(testDatabase().path), "chat.sqlite"),
    );
    const assistant = createCatalogAssistant(
      { createRun: vi.fn() },
      chat.memory,
    );
    try {
      const result = await assistant.generate("Hello", {
        model,
        modelSettings: { maxRetries: 0 },
      });
      expect(result.text).toBe("Ready.");
      expect(fetchModel).toHaveBeenCalledTimes(1);
      const [address, init] = fetchModel.mock.calls[0];
      expect(String(address)).toContain(host);
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer fixture-direct",
      );
      const request = JSON.parse(String(init?.body));
      expect(request).not.toHaveProperty("service_tier");
      expect(request).not.toHaveProperty("reasoning");
    } finally {
      await chat.memory.settled();
      await chat.storage.close();
    }
  },
);

function mockProvider() {
  const fetchModel = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!/api\.openai\.com|api\.deepseek\.com|openrouter\.ai/.test(url)) {
        throw new Error("Unexpected fixture request");
      }
      const request = JSON.parse(String(init?.body));
      if (url.endsWith("/responses")) {
        return Response.json({
          id: "resp_fixture",
          object: "response",
          created_at: 1,
          model: request.model,
          status: "completed",
          output: [
            {
              type: "message",
              id: "msg_fixture",
              role: "assistant",
              status: "completed",
              content: [
                { type: "output_text", text: "Ready.", annotations: [] },
              ],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        });
      }
      return Response.json({
        id: "chat_fixture",
        object: "chat.completion",
        created: 1,
        model: request.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Ready." },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
  );
  vi.stubGlobal("fetch", fetchModel);
  return fetchModel;
}
