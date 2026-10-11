import { afterEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import { editorPlanSchema } from "./contracts";
import { normalizeEditorWire } from "./wire";
import { prepareEditorPlan, validateResearch } from "./prepare";
import { runCatalogResearch } from "../workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../runtime/budget";
import type { ResearchCandidate } from "../research/contracts";

afterEach(() => vi.restoreAllMocks());
const reason = "Organizer explicitly withdrew the old venue";
function fixture() {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Editor Fest" });
  const terms = fx.festivalTerms();
  const edition = fx.edition(event, {
    editionKey: "2027",
    editionYear: 2027,
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
    countryCode: "PT",
    locality: "Lisbon",
    venueName: "Old venue",
  });
  for (const term of terms) {
    fx.assignTerm(edition, term);
  }
  const catalog = [readResearchEvent(client, event.id)!];
  const vocabulary = terms.map((term) => ({
    id: term.id,
    facet: term.facet,
    slug: term.slug,
  }));
  const input = {
    mode: "refresh" as const,
    scope: "current" as const,
    eventId: event.id,
    actor: "test",
    dryRun: true,
  };
  const research: ResearchCandidate = {
    status: "success",
    data: {
      eventName: "Editor Fest",
      eventId: event.id,
      links: { socials: {} },
      sources: [
        { url: "https://example.org/announcement", information: reason },
      ],
      editions: [
        { key: "2027", venueName: { value: null, reason }, links: {} },
      ],
    },
    errors: [],
    unresolved: [],
  };
  const plan = {
    event: { target: { eventId: event.id }, fields: {} },
    editions: [{ target: { editionKey: "2027" }, fields: {} }],
    unresolved: [],
  };
  return {
    client,
    fx,
    event,
    edition,
    catalog,
    vocabulary,
    input,
    research,
    plan,
  };
}
function prepare(f: ReturnType<typeof fixture>, plan: unknown) {
  return prepareEditorPlan(
    plan,
    validateResearch(f.research, f.catalog, f.input),
    f.catalog,
    f.input,
    f.vocabulary,
  );
}

test("strict actions reject unsupported metadata, null sets and malformed unions", () => {
  const f = fixture();
  for (const action of [
    { action: "set", value: null, reason },
    { action: "clear", value: "", reason },
    { action: "keep", value: "Old venue", reason },
    { action: "clear" },
    { action: "delete", reason },
  ]) {
    expect(
      editorPlanSchema.safeParse({
        ...f.plan,
        editions: [
          { target: { editionKey: "2027" }, fields: { venueName: action } },
        ],
      }).success,
    ).toBe(false);
  }
  expect(
    editorPlanSchema.safeParse({
      ...f.plan,
      event: {
        target: { eventId: f.event.id },
        fields: {
          links: {
            socials: {
              x: {
                action: "set",
                value: "ftp://twitter.com/editorfest",
                reason,
              },
            },
          },
        },
      },
    }).success,
  ).toBe(false);
  expect(
    editorPlanSchema.safeParse({
      ...f.plan,
      event: {
        target: { eventId: f.event.id },
        fields: {
          links: {
            socials: { x: { action: "set", value: "https://%", reason } },
          },
        },
      },
    }).success,
  ).toBe(false);
  expect(
    editorPlanSchema.safeParse({ ...f.plan, expectedVersion: 1 }).success,
  ).toBe(false);
  expect(
    editorPlanSchema.safeParse({
      ...f.plan,
      editions: [...f.plan.editions, ...f.plan.editions],
    }).success,
  ).toBe(false);
  expect(editorPlanSchema.safeParse({ ...f.plan, event: null }).success).toBe(
    false,
  );
});

test("wire omission never becomes clear and invalid required action values survive normalization", () => {
  const f = fixture();
  const raw = {
    ...f.plan,
    editions: [
      {
        target: { editionKey: "2027" },
        fields: {
          venueName: null,
          tickets: { action: "set", value: null, reason },
        },
      },
    ],
  };
  const normalized = normalizeEditorWire(raw) as typeof raw;
  expect(normalized.editions[0].fields).not.toHaveProperty("venueName");
  expect(normalized.editions[0].fields.tickets.value).toBeNull();
  expect(editorPlanSchema.safeParse(normalized).success).toBe(false);
});

test("clear changes only its field and eligible kept content still publishes", () => {
  const f = fixture();
  const plan = {
    ...f.plan,
    editions: [
      {
        target: { editionKey: "2027" },
        fields: { venueName: { action: "clear", reason } },
      },
    ],
  };
  const prepared = prepare(f, plan);
  expect(prepared.errors).toEqual([]);
  const applied = applyCatalogItem(f.client, prepared.operations, {
    dryRun: true,
  });
  expect(
    applied.changes.some((change) =>
      change.changedFields.some(
        (field) => field.field === "venue_name" && field.newValue === null,
      ),
    ),
  ).toBe(true);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0].venueName).toBe(
    "Old venue",
  );
  expect(
    prepare(f, f.plan).operations.some((op) => op.kind === "publishEdition"),
  ).toBe(true);
  expect(prepare(f, { ...f.plan, editions: [] }).operations).toEqual([]);
});

test("final target, scope, country, term and creation checks reject the entire plan", () => {
  const f = fixture();
  for (const plan of [
    {
      ...f.plan,
      event: null,
      editions: [],
      unresolved: [{ message: "Insufficient evidence" }],
    },
    { ...f.plan, event: { target: { eventId: "other" }, fields: {} } },
    {
      ...f.plan,
      editions: [{ target: { editionKey: "unknown" }, fields: {} }],
    },
    {
      ...f.plan,
      editions: [
        {
          target: { editionKey: "2027" },
          fields: { countryCode: { action: "clear", reason } },
        },
      ],
    },
    {
      ...f.plan,
      editions: [
        {
          target: { editionKey: "2027" },
          fields: {
            classification: { action: "set", value: ["unknown"], reason },
          },
        },
      ],
    },
  ]) {
    const result = prepare(f, plan);
    expect(result.operations).toEqual([]);
    expect(result.errors.at(-1)?.code).toBe("invalid_plan");
  }
});

test("invalid editor output is retained with independent successful research and no writes", async () => {
  const f = fixture();
  const invalid = { ...f.plan, unexpected: true };
  const result = await runCatalogResearch(f.input, {
    client: f.client,
    generateCandidate: async () => f.research,
    generateEditor: async () => invalid,
  });
  expect(result).toMatchObject({
    schemaVersion: 5,
    outcome: "failed",
    researchStatus: "success",
    editorStatus: "failed",
    editorResponse: { object: invalid },
  });
  expect(result.operations).toEqual([]);
  expect(result.errors.at(-1)?.code).toBe("invalid_plan");
  expect(
    JSON.parse(
      (
        f.client
          .prepare("SELECT report_json FROM ingestion_runs WHERE id=?")
          .get(result.runId) as { report_json: string }
      ).report_json,
    ),
  ).toEqual(result);
});

test("editor failure never falls back to research writes", async () => {
  const f = fixture();
  const editor = vi.fn(async () => {
    throw new Error("private transport payload");
  });
  const result = await runCatalogResearch(f.input, {
    client: f.client,
    generateCandidate: async () => f.research,
    generateEditor: editor,
  });
  expect(editor).toHaveBeenCalledTimes(1);
  expect(result.editorStatus).toBe("failed");
  expect(result.researchStatus).toBe("success");
  expect(result.outcome).toBe("failed");
  expect(result.operations).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("private transport payload");
});

test("research country refutation rejects before editor while omission allows it", async () => {
  const f = fixture();
  f.research.data!.editions[0].countryCode = { value: null, reason };
  const editor = vi.fn(async () => f.plan);
  const rejected = await runCatalogResearch(f.input, {
    client: f.client,
    generateCandidate: async () => f.research,
    generateEditor: editor,
  });
  expect(editor).not.toHaveBeenCalled();
  expect(rejected.editorStatus).toBe("not_run");
  expect(rejected.outcome).toBe("failed");
  expect(rejected.researchStatus).toBe("success");
  delete f.research.data!.editions[0].countryCode;
  await runCatalogResearch(f.input, {
    client: f.client,
    generateCandidate: async () => f.research,
    generateEditor: editor,
  });
  expect(editor).toHaveBeenCalledTimes(1);
});

test("add may decline creation and reuse unresolved question objects", async () => {
  const f = fixture();
  const research = structuredClone(f.research);
  delete research.data!.eventId;
  research.data!.eventName = "New Fest";
  research.data!.editions = [];
  const result = await runCatalogResearch(
    { mode: "add", name: "New Fest", actor: "test", dryRun: true },
    {
      client: f.client,
      generateCandidate: async () => research,
      generateEditor: async () => ({
        event: null,
        editions: [],
        unresolved: [
          {
            message: "Sources do not establish festival identity",
            field: "identity",
          },
        ],
      }),
    },
  );
  expect(result.outcome).toBe("skipped");
  expect(result.editorStatus).toBe("success");
  expect(result.operations).toEqual([]);
  expect(result.unresolved[0].field).toBe("identity");
});

test("research and one tool-free editor share date, configuration and total usage without double counting", async () => {
  const f = fixture();
  const prompts: Record<string, unknown>[] = [];
  vi.spyOn(Agent.prototype, "generate").mockImplementation(async function (
    this: Agent,
    prompt: unknown,
    options?: {
      maxSteps?: number;
      modelSettings?: { maxRetries?: number };
      onStepFinish?: (step: unknown) => unknown;
      prepareStep?: () => unknown;
    },
  ) {
    prompts.push(JSON.parse(prompt as string));
    const editing = this.id === "festival-editor";
    if (editing) {
      expect(options).toMatchObject({
        maxSteps: 1,
        maxProcessorRetries: 0,
        activeTools: [],
        toolChoice: "none",
      });
      expect(options?.modelSettings?.maxRetries).toBe(0);
    }
    options?.prepareStep?.();
    options?.onStepFinish?.({
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        raw: { prompt_tokens: 10, completion_tokens: 5 },
      },
      providerMetadata: {
        openrouter: {
          usage: {
            cost: 0.01,
            promptTokensDetails: { cachedTokens: 2 },
            completionTokensDetails: { reasoningTokens: 1 },
          },
        },
      },
      finishReason: "stop",
    } as never);
    return {
      object: editing ? f.plan : f.research,
      text: "",
      finishReason: "stop",
    } as never;
  });
  const result = await runCatalogResearch(f.input, {
    client: f.client,
    todayUtc: "2026-10-12",
    config: {
      apiKey: "fixture",
      model: "fixture/model",
      limits: DEFAULT_RESEARCH_LIMITS,
    },
  });
  expect(prompts).toHaveLength(2);
  expect(prompts[0].currentDate).toBe(prompts[1].currentDate);
  expect(result.usage).toMatchObject({
    inputTokens: 20,
    outputTokens: 10,
    cachedInputTokens: 4,
    reasoningTokens: 2,
    modelCostUsd: 0.02,
    modelCalls: 2,
  });
});

test("editor cancellation and exhausted deadline stop without fallback mutations", async () => {
  const f = fixture();
  const { editResearch } = await import("./agent");
  const { createResearchBudget } = await import("../runtime/budget");
  const config = {
    apiKey: "fixture",
    model: "fixture/model",
    limits: DEFAULT_RESEARCH_LIMITS,
  };
  const context = {
    catalog: f.catalog,
    terms: f.vocabulary,
    knownLinks: [],
    currentDate: "2026-10-12T12:00:00.000Z",
  };
  const abort = new AbortController();
  const editor = vi.fn(async (_prompt, { abortSignal }) => {
    abort.abort();
    return new Promise((_resolve, reject) =>
      abortSignal.addEventListener("abort", () => reject(abortSignal.reason), {
        once: true,
      }),
    );
  });
  const result = await editResearch(
    f.research,
    f.input,
    context,
    createResearchBudget(),
    config,
    { generateEditor: editor },
    undefined,
    abort.signal,
  );
  expect(result.status).toBe("failed");
  expect(editor).toHaveBeenCalledTimes(1);
  const expired = await editResearch(
    f.research,
    f.input,
    context,
    createResearchBudget({ durationMs: 0 }),
    config,
    { generateEditor: editor },
  );
  expect(expired.errors[0].code).toBe("limit_reached");
  expect(editor).toHaveBeenCalledTimes(1);
});

test("clear official-site slot preserves other saved link kinds", () => {
  const f = fixture();
  f.fx.link(
    { event: f.event },
    { kind: "official_site", url: "https://old.example.org", official: true },
  );
  f.fx.link(
    { event: f.event },
    {
      kind: "instagram",
      url: "https://instagram.com/editorfest",
      official: true,
    },
  );
  f.catalog[0] = readResearchEvent(f.client, f.event.id)!;
  const plan = {
    ...f.plan,
    event: {
      target: { eventId: f.event.id },
      fields: { links: { website: { action: "clear", reason } } },
    },
    editions: [],
  };
  const prepared = prepare(f, plan);
  const replacement = prepared.operations.find(
    (op) => op.kind === "replaceLinks",
  );
  expect(replacement).toMatchObject({
    links: [{ kind: "instagram", url: "https://instagram.com/editorfest" }],
  });
});
