import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { modelReply, providerPrompt } from "@/test/ingestion-provider";
import { afterEach, expect, it, vi } from "vitest";
import { invokeRole, type RoleConversation } from "./invoke";
import { generalOutputSchema } from "./general/contracts";
import { linksOutputSchema } from "./links/contracts";
import { createResearchBudget } from "../runtime/budget";
import { reviewSchema, validateEditorReply } from "./editor/validate";
afterEach(() => vi.unstubAllGlobals());

it.each([
  {
    first: { decisions: [] },
    feedback: "Add the required decision for item",
    decision: "approve",
    status: "success",
  },
  {
    first: { decisions: 42 },
    feedback: "expected array",
    decision: "return",
    status: "failed",
  },
])(
  "validates the Editor correction after native tool use ($status)",
  async ({ first, feedback, decision, status }) => {
    const paths = [
      { path: "item", required: true, allowed: ["approve" as const] },
    ];
    const schema = reviewSchema(paths);
    const corrected = {
      decisions: [
        { path: "item", decision, note: "The source confirms this." },
      ],
    };
    const savedResult = "Only guests over 18 are eligible.";
    const lookup = createTool({
      id: "lookup",
      description: "Read the saved page.",
      inputSchema: z.object({}),
      execute: async () => savedResult,
    });
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      if (fetch.mock.calls.length === 1) {
        return modelReply(null, { id: "lookup", name: "lookup", args: {} });
      }
      if (fetch.mock.calls.length === 2) {
        return modelReply(JSON.stringify(first));
      }
      expect(JSON.stringify(request.messages)).toContain(savedResult);
      expect(JSON.stringify(request.messages)).toContain("reviewPaths");
      expect(
        providerPrompt(request).validationFeedback.errors[0].message,
      ).toContain(feedback);
      expect(request.tools ?? []).toEqual([]);
      return modelReply(JSON.stringify(corrected));
    });
    vi.stubGlobal("fetch", fetch);
    const budget = createResearchBudget();
    const result = await invokeRole({
      role: "editor",
      version: "test",
      instructions: "Review the item using the saved source.",
      input: { reviewPaths: paths },
      schema,
      validateReply: (reply) => validateEditorReply(schema, reply),
      budget,
      config: {
        apiKey: "fixture",
        model: "fixture/model",
        limits: budget.limits,
      },
      tools: { lookup },
      steps: 2,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(budget.snapshot().modelCalls).toBe(3);
    expect(result.status).toBe(status);
    if (status === "success") {
      expect(result.output).toEqual(corrected);
      expect(result.errors).toEqual([]);
    } else {
      expect(result.output).toBeUndefined();
      expect(result.errors[0]).toMatchObject({
        code: "invalid_plan",
        message: expect.stringContaining("Choose approve"),
      });
    }
  },
);

it("reads a tool-free Links revision when the wire schema fails", async () => {
  const initial = {
    event: { website: null, socials: {} },
    currentOrNextEdition: { tickets: null },
    checks: [],
    omitted: [],
    unresolved: [],
  };
  const revised = { ...initial, currentOrNextEdition: { tickets: 12 } };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(modelReply(JSON.stringify(initial)))
    .mockResolvedValueOnce(modelReply(JSON.stringify(revised)));
  vi.stubGlobal("fetch", fetch);
  const budget = createResearchBudget();
  let captured: RoleConversation | undefined;
  await invokeRole({
    role: "links",
    version: "test",
    instructions: "Check the website.",
    input: {},
    schema: linksOutputSchema,
    budget,
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: budget.limits,
    },
    tools: {
      lookup: createTool({
        id: "lookup",
        description: "Read the saved page.",
        inputSchema: z.object({}),
        execute: async () => "Official website",
      }),
    },
    capture: (_role, conversation) => {
      captured = conversation;
    },
  });
  const revision = await captured!.revise!({}, new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(2);
  const request = JSON.parse(String(fetch.mock.calls[1][1]?.body));
  expect(request.tools ?? []).toEqual([]);
  expect(revision).toMatchObject({
    status: "success",
    output: { currentOrNextEdition: { tickets: 12 } },
  });
});
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
    return modelReply(JSON.stringify({ result: domain }));
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

it("retains the Reader evidence branches and required null uncertainty", async () => {
  const { readerOutputSchema } = await import("./reader/contracts");
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
