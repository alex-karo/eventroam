import { z } from "zod";
import { normalizeRoleWire } from "./wire";
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
    normalizeOutput: (value) => normalizeRoleWire("general", value),
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
    normalizeOutput: (value) => normalizeRoleWire("general", value),
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
      normalizeOutput: (value) => normalizeRoleWire("general", value),
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

it("preserves required nullable values in a custom Reader union", async () => {
  const schema = z.union([
    z.strictObject({ a: z.string(), x: z.string().optional() }),
    z.strictObject({ b: z.string(), x: z.string().nullable() }),
  ]);
  const raw = { b: "value", x: null };
  const budget = createResearchBudget();
  const result = await invokeRole({
    role: "reader",
    version: "test",
    instructions: "Fixture",
    input: {},
    schema,
    budget,
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: budget.limits,
    },
    generate: async () => raw,
  });
  expect(result.status).toBe("success");
  expect(result.output).toEqual(raw);
});

it("retains the Reader evidence branches and required null uncertainty", async () => {
  const { readerOutputSchema } = await import("../evidence/contracts");
  const raw = {
    overview: "Official programme",
    coverage: { found: ["Dates"], notPublished: [] },
    topics: ["dates"],
    statedYears: ["2027"],
    limitations: [],
    evidence: [
      { quote: "Festival dates", topics: ["dates"] },
      {
        quote: { start: "Festival", end: "July" },
        topics: ["dates"],
        context: [],
        editionClues: ["2027"],
        uncertainty: null,
      },
    ],
  };
  const budget = createResearchBudget();
  const result = await invokeRole({
    role: "reader",
    version: "test",
    instructions: "Fixture",
    input: {},
    schema: readerOutputSchema,
    budget,
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: budget.limits,
    },
    generate: async () => raw,
  });
  expect(result.status).toBe("success");
  expect(result.output).toEqual(raw);
  expect(result.modelResponse?.object).toEqual(raw);
});

it.each([false, true])(
  "preserves limit classification for an aborted signal after deadline %s",
  async (expired) => {
    const controller = new AbortController();
    controller.abort(Symbol("fixture cancellation"));
    const budget = createResearchBudget();
    const pending = invokeRole({
      role: "general",
      version: "test",
      instructions: "Fixture",
      input: {},
      schema: generalOutputSchema,
      budget,
      deadline: expired ? Date.now() - 1 : budget.deadline,
      config: {
        apiKey: "fixture",
        model: "fixture/model",
        limits: budget.limits,
      },
      signal: controller.signal,
      generate: vi.fn(),
    });
    if (expired) {
      expect(await pending).toMatchObject({
        status: "failed",
        errors: [{ code: "limit_reached" }],
      });
    } else {
      await expect(pending).rejects.toBe(controller.signal.reason);
    }
  },
);
