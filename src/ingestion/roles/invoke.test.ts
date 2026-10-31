import { afterEach, expect, it, vi } from "vitest";
import { invokeRole } from "./invoke";
import { generalOutputSchema } from "./contracts";
import { createResearchBudget } from "../runtime/budget";
afterEach(() => vi.unstubAllGlobals());
it("uses an object transport envelope for General and retains the actual response", async () => {
  const domain = {
    decision: "duplicate",
    eventId: "event",
    observedEventName: "Festival",
    reason: "Official identity",
    evidenceIds: ["s1-e1"],
  };
  const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const schema = request.response_format.json_schema.schema;
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["result"]);
    expect(schema.properties.result.anyOf).toHaveLength(3);
    return Response.json({
      id: "fixture",
      object: "chat.completion",
      created: 1,
      model: "fixture/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ result: domain }),
          },
          finish_reason: "stop",
        },
      ],
    });
  });
  vi.stubGlobal("fetch", fetch);
  const budget = createResearchBudget();
  const result = await invokeRole({
    role: "general",
    version: "test",
    instructions: "Fixture",
    input: {},
    schema: generalOutputSchema,
    budget,
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: budget.limits,
    },
  });
  expect(result.errors).toEqual([]);
  expect(result.output).toEqual(domain);
  expect(result.modelResponse?.object).toEqual({ result: domain });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("keeps host failure separate from a valid domain decision", async () => {
  const budget = createResearchBudget();
  const result = await invokeRole({
    role: "general",
    version: "test",
    instructions: "Fixture",
    input: {},
    schema: generalOutputSchema,
    budget,
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: budget.limits,
    },
    generate: async () => ({
      decision: "uncertain",
      reason: "No identity support",
      unresolved: [],
    }),
  });
  expect(result.status).toBe("success");
  expect(result.output?.decision).toBe("uncertain");
  expect(result.errors).toEqual([]);
});
