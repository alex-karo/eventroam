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
it("accepts a valid domain decision with a reason above the length guidance", async () => {
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
      reason: "No identity support. ".repeat(101).trim(),
      unresolved: [],
    }),
  });
  expect(result.status).toBe("success");
  expect(result.output).toEqual({
    decision: "uncertain",
    reason: "No identity support. ".repeat(101).trim(),
    unresolved: [],
  });
  expect(result.errors).toEqual([]);
});

it.each([
  {
    field: {
      action: "set",
      value: null,
      reason: "Invalid null set",
      evidenceIds: ["s1-e1"],
    },
    valid: false,
  },
  {
    field: {
      action: "set",
      value: 2027,
      reason: "Official year",
      evidenceIds: ["s1-e1"],
    },
    valid: true,
  },
])(
  "validates required action values after nullable wire normalization: $valid",
  async ({ field, valid }) => {
    const budget = createResearchBudget();
    const raw = {
      decision: "targets",
      eventId: null,
      observedEventName: "Festival",
      reason: "Official identity",
      evidenceIds: ["s1-e1"],
      event: { summary: null },
      previousEdition: null,
      currentOrNextEdition: {
        editionKey: "2027",
        reason: "Announced Edition",
        evidenceIds: ["s1-e1"],
        fields: { year: field, dates: null, sizeEstimate: null },
      },
      checks: [],
      unresolved: [],
    };
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
      generate: async () => raw,
    });
    expect(result.status).toBe(valid ? "success" : "failed");
    expect(result.modelResponse?.object).toEqual(raw);
    if (valid) {
      expect(result.output).toMatchObject({
        event: {},
        currentOrNextEdition: { fields: { year: field } },
      });
      if (result.output?.decision === "targets") {
        expect(result.output.currentOrNextEdition!.fields).not.toHaveProperty(
          "dates",
        );
      }
    } else {
      expect(result.errors[0].message).toContain("value");
    }
  },
);
