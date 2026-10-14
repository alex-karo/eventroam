import { afterEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import { editorPlanSchema } from "./contracts";
import { editorModelOutputSchema, normalizeEditorWire } from "./wire";

test("provider editor schema requires the same ready arrays as local validation", () => {
  const schema = editorModelOutputSchema();
  expect(schema.type).toBe("object");
  expect(schema).not.toHaveProperty("anyOf");
  expect(schema.required).toEqual(
    expect.arrayContaining(["event", "editions", "unresolved"]),
  );
  expect(schema.properties).toMatchObject({
    editions: { type: "array" },
    unresolved: { type: "array" },
  });
  expect(schema.properties?.editions).not.toHaveProperty("anyOf");
  expect(schema.properties?.unresolved).not.toHaveProperty("anyOf");
  const f = fixture();
  expect(
    editorPlanSchema.parse(
      normalizeEditorWire({
        ...f.plan,
        reason: null,
        event: { fields: {}, reason: null },
        editions: [{ editionKey: "2027", fields: {}, reason: null }],
      }),
    ),
  ).toEqual(f.plan);
});

test("rejected transport drops only empty branch placeholders", () => {
  const rejected = {
    status: "rejected",
    reason: "Wrong festival",
    event: null,
    editions: [],
    unresolved: [],
  };
  expect(editorPlanSchema.parse(normalizeEditorWire(rejected))).toEqual({
    status: "rejected",
    reason: "Wrong festival",
  });
  for (const patch of [
    { editions: [{}] },
    { unresolved: [{ message: "Unexpected question" }] },
    { event: { target: { eventId: "unexpected" }, fields: {} } },
    { editions: null },
    { unresolved: null },
  ]) {
    expect(
      editorPlanSchema.safeParse(normalizeEditorWire({ ...rejected, ...patch }))
        .success,
    ).toBe(false);
  }
});

test.each(["editions", "unresolved"])(
  "ready %s cannot be null or missing",
  (field) => {
    const f = fixture();
    for (const value of [null, undefined]) {
      const result = prepare(f, { ...f.plan, [field]: value });
      expect(result.operations).toEqual([]);
      expect(result.errors.at(-1)).toMatchObject({
        code: "invalid_plan",
        field,
      });
    }
  },
);
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
    scope: "current" as "current" | "full",
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
    status: "ready" as const,
    event: { fields: {} },
    editions: [{ editionKey: "2027", fields: {} }],
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
        editions: [{ editionKey: "2027", fields: { venueName: action } }],
      }).success,
    ).toBe(false);
  }
  expect(
    editorPlanSchema.safeParse({
      ...f.plan,
      event: {
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
        editionKey: "2027",
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
        editionKey: "2027",
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
    ...[
      { eventId: f.event.id },
      { canonicalName: "Other festival" },
      { target: { eventId: f.event.id } },
      { target: { create: { canonicalName: "Other festival" }, reason } },
    ].map((identity) => ({ ...f.plan, event: { ...identity, fields: {} } })),
    ...[
      { target: { editionKey: "2027" } },
      { target: { create: { editionKey: "2028" }, reason } },
      { editionKey: null },
      {},
    ].map((identity) => ({
      ...f.plan,
      editions: [{ ...identity, fields: {} }],
    })),
    {
      ...f.plan,
      editions: [{ editionKey: "unknown", fields: {} }],
    },
    {
      ...f.plan,
      editions: [
        {
          editionKey: "2027",
          fields: { countryCode: { action: "clear", reason } },
        },
      ],
    },
    {
      ...f.plan,
      editions: [
        {
          editionKey: "2027",
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
  for (const [scope, keys] of [
    ["current", ["2027", "2028"]],
    ["full", ["2028", "2029"]],
  ] as const) {
    f.input.scope = scope;
    const result = prepare(f, {
      ...f.plan,
      editions: keys.map((editionKey) => ({ editionKey, reason, fields: {} })),
    });
    expect(result.operations).toEqual([]);
    expect(result.errors.at(-1)?.message).toBe(
      "Editorial plan exceeds refresh scope bounds",
    );
  }
  for (let i = 0; i < 19; i++) {
    f.fx.edition(f.event, { editionKey: `old-${i}` });
  }
  f.catalog[0] = readResearchEvent(f.client, f.event.id)!;
  const overLimit = prepare(f, {
    ...f.plan,
    editions: [{ editionKey: "2028", reason, fields: {} }],
  });
  expect(overLimit.operations).toEqual([]);
  expect(overLimit.errors.at(-1)?.message).toBe(
    "Editorial plan exceeds refresh scope bounds",
  );
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
        status: "ready",
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
  f.research.data!.links.website = ""; // Structured refutation of this slot.
  const plan = {
    ...f.plan,
    event: {
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

test.each(["add", "refresh"] as const)(
  "editor rejects useful partial research with an identity conflict and blocks all %s writes",
  async (mode) => {
    const f = fixture();
    f.research.status = "partial";
    f.research.data!.editions = [];
    f.research.data!.sources[0].information =
      "The supplied website belongs to Soma in Australia, not the saved festival in Ireland";
    f.research.data!.summary = {
      value: "An outdoor music festival",
      reason: "A verified target source confirms the festival format",
    };
    f.research.data!.sources.push({
      url: "https://example.org/target-festival",
      information: f.research.data!.summary.reason,
    });
    f.research.unresolved = [
      { message: "Festival identity conflicts with saved location" },
    ];
    if (mode === "add") {
      delete f.research.data!.eventId;
    }
    const rejection = {
      status: "rejected" as const,
      reason: "Research concerns a different Soma festival in Australia",
    };
    const editor = vi.fn(async () => rejection);
    const before = readResearchEvent(f.client, f.event.id);
    const result = await runCatalogResearch(
      mode === "refresh"
        ? { ...f.input, dryRun: false }
        : { mode, name: "Soma", actor: "test", dryRun: false },
      {
        client: f.client,
        generateCandidate: async () => f.research,
        generateEditor: editor,
      },
    );
    expect(editor).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      researchStatus: "partial",
      outcome: "failed",
      editorStatus: "success",
      operations: [],
      changes: [],
      receipts: [],
      modelResponse: { object: f.research },
      editorResponse: { object: rejection },
    });
    expect(result.sourceSummaries).toEqual(f.research.data!.sources);
    expect(result.errors).toContainEqual({
      code: "editor_rejected",
      stage: "editor",
      message: rejection.reason,
    });
    expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
  },
);

test("editor output requires a status and keeps rejection separate from actions", () => {
  const f = fixture();
  const { status, ...oldPlan } = f.plan;
  expect(status).toBe("ready");
  for (const raw of [
    oldPlan,
    { status: "rejected", reason: "" },
    { ...f.plan, status: "rejected", reason: "Conflict" },
  ]) {
    expect(editorPlanSchema.safeParse(raw).success).toBe(false);
  }
  expect(
    editorPlanSchema.safeParse({
      status: "rejected",
      reason: "Identity conflict",
    }).success,
  ).toBe(true);
});

test.each(["dates", "venueName", "tickets", "classification", "links"])(
  "editor cannot extract %s from summaries without same-Edition findings",
  (field) => {
    const f = fixture();
    f.research.data!.editions = [];
    f.research.data!.sources[0].information =
      "Another festival occurs in Australia, 6–9 November 2026, with free admission";
    const actions = {
      dates: {
        action: "set",
        value: {
          startsOn: "2026-11-06",
          endsOn: "2026-11-09",
          state: "confirmed",
        },
        reason,
      },
      venueName: { action: "clear", reason },
      tickets: {
        action: "set",
        value: { variants: [], basePrice: null },
        reason,
      },
      classification: { action: "set", value: [], reason },
      links: {
        tickets: {
          action: "set",
          value: "https://example.org/tickets",
          reason,
        },
      },
    };
    const result = prepare(f, {
      ...f.plan,
      editions: [
        {
          editionKey: "2027",
          fields: { [field]: actions[field as keyof typeof actions] },
        },
      ],
    });
    expect(result.operations).toEqual([]);
    expect(result.errors.at(-1)).toMatchObject({ code: "invalid_plan" });
    expect(prepare(f, f.plan).errors).toEqual([]); // Preserving a considered Edition is still allowed.
  },
);

test("a finding for another field or Edition cannot authorize a mutation", () => {
  const f = fixture();
  f.input.scope = "full";
  f.research.data!.editions.push({
    key: "2028",
    locality: { value: "Sydney", reason },
    links: {},
  });
  const result = prepare(f, {
    ...f.plan,
    editions: [
      {
        editionKey: "2027",
        fields: { locality: { action: "set", value: "Sydney", reason } },
      },
    ],
  });
  expect(result.errors.at(-1)?.field).toBe("editions.0.fields.locality");
  expect(result.operations).toEqual([]);
});

test("source summaries alone cannot authorize Event links or summary", () => {
  const f = fixture();
  for (const fields of [
    { summary: { action: "set", value: "Wrong festival", reason } },
    {
      links: {
        website: { action: "set", value: "https://other.example.org", reason },
      },
    },
  ]) {
    const result = prepare(f, {
      ...f.plan,
      event: { fields },
    });
    expect(result.errors.at(-1)?.code).toBe("invalid_plan");
    expect(result.operations).toEqual([]);
  }
});

test("free concession without currency survives wire, editing and persistence", async () => {
  const f = fixture();
  const { normalizeWireCandidate } = await import("../research/agent/wire");
  const { fixtureEditorPlan } = await import("@/test/ingestion");
  const { modelContext } = await import("../research/agent/input");
  f.research.data!.editions[0].tickets = {
    value: {
      variants: [
        {
          label: "Personal assistant",
          amount: 0,
          terms: "Eligible accompanying assistant only",
        },
      ],
      basePrice: null,
    },
    reason,
  };
  const wire = structuredClone(f.research);
  Object.assign(wire.data!.editions[0].tickets!.value.variants[0], {
    currency: null,
  });
  const normalized = normalizeWireCandidate(wire) as ResearchCandidate;
  const result = await runCatalogResearch(
    { ...f.input, dryRun: false },
    {
      client: f.client,
      generateCandidate: async () => normalized,
      generateEditor: async () =>
        fixtureEditorPlan(normalized, modelContext(f.catalog[0])),
    },
  );
  expect(result.errors).toEqual([]);
  expect(result.outcome).not.toBe("failed");
  expect(
    readResearchEvent(f.client, f.event.id)!.editions[0].priceDetails,
  ).toEqual([
    {
      label: "Personal assistant",
      amount: 0,
      terms: "Eligible accompanying assistant only",
    },
  ]);
  expect(
    readResearchEvent(f.client, f.event.id)!.editions[0].priceKind,
  ).toBeNull();
});

test("accept resolves keyed fields, complete blocks and links without changing the raw response", () => {
  const f = fixture();
  const data = f.research.data!;
  data.summary = {
    value: "Supported description",
    reason: "Organizer description",
  };
  data.links.website = "https://example.org/festival";
  data.editions[0].venueName = {
    value: "New venue",
    reason: "Organizer venue",
  };
  data.editions[0].dates = {
    value: { startsOn: "2027-07-10", endsOn: "2027-07-12", state: "confirmed" },
    reason: "Organizer dates",
  };
  data.editions[0].tickets = {
    value: {
      variants: [{ label: "Free admission", amount: 0 }],
      basePrice: { kind: "free", coverage: "full_programme" },
    },
    reason: "Organizer tickets",
  };
  const plan = {
    ...f.plan,
    event: {
      ...f.plan.event,
      fields: {
        summary: { action: "accept" },
        links: { website: { action: "accept" } },
      },
    },
    editions: [
      {
        editionKey: "2027",
        fields: {
          venueName: { action: "accept" },
          dates: { action: "accept" },
          tickets: { action: "accept" },
        },
      },
    ],
  };
  const before = structuredClone(plan);
  const result = prepare(f, plan);
  expect(result.errors).toEqual([]);
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "updateEvent",
      data: { summary: "Supported description" },
    }),
  );
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "updateEdition",
      id: f.edition.id,
      data: expect.objectContaining({
        venueName: "New venue",
        startsOn: "2027-07-10",
        endsOn: "2027-07-12",
      }),
    }),
  );
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "replacePriceBlock",
      priceDetails: data.editions[0].tickets!.value.variants,
    }),
  );
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "replaceLinks",
      links: [
        expect.objectContaining({
          kind: "official_site",
          url: data.links.website,
        }),
      ],
    }),
  );
  expect(
    Object.values(result.explanations).flatMap(Object.values).flat(),
  ).toContain("Organizer venue");
  expect(
    result.operations.some(
      (op) => op.kind === "createEvent" || op.kind === "createEdition",
    ),
  ).toBe(false);
  expect(plan).toEqual(before);
});

test.each(["missing", "null", "wrong-edition", "incompatible"] as const)(
  "accept rejects %s findings atomically",
  (variant) => {
    const f = fixture();
    if (variant === "missing") {
      delete f.research.data!.editions[0].venueName;
    }
    if (variant === "wrong-edition") {
      f.research.data!.editions[0].key = "2026";
    }
    if (variant === "incompatible") {
      f.research.data!.summary = { value: "", reason };
      f.research.data!.editions[0].venueName = {
        value: "Supported venue",
        reason,
      };
    }
    const result = prepare(f, {
      ...f.plan,
      event: {
        ...f.plan.event,
        fields:
          variant === "incompatible" ? { summary: { action: "accept" } } : {},
      },
      editions: [
        {
          editionKey: "2027",
          fields: { venueName: { action: "accept" } },
        },
      ],
    });
    expect(result.operations).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid_plan" }),
    );
  },
);

test("classification accept preserves saved terms, adds a new term and retains a 500-character reason", () => {
  const f = fixture();
  const ids = f.catalog[0].editions[0].terms.map((term) => term.id);
  const added = f.fx.term({ facet: "topic", slug: "new-category" });
  f.vocabulary.push({ id: added.id, facet: added.facet, slug: added.slug });
  const classificationReason = "a".repeat(500);
  f.research.data!.editions[0].classification = {
    value: [...ids, added.id],
    reason: classificationReason,
  };
  f.research.data!.editions[0].venueName = { value: "New venue", reason };
  const result = prepare(f, {
    ...f.plan,
    editions: [
      {
        editionKey: "2027",
        fields: {
          classification: { action: "accept" },
          venueName: { action: "accept" },
        },
      },
    ],
  });
  expect(result.errors).toEqual([]);
  const termsOp = result.operations.find((op) => op.kind === "replaceTerms")!;
  expect(termsOp).toMatchObject({ termIds: [...ids, added.id] });
  expect(result.explanations[termsOp.operationKey].terms).toEqual([
    classificationReason,
  ]);
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "updateEdition",
      data: expect.objectContaining({ venueName: "New venue" }),
    }),
  );
  applyCatalogItem(f.client, result.operations);
  expect(
    readResearchEvent(f.client, f.event.id)!
      .editions[0].terms.map((term) => term.id)
      .sort(),
  ).toEqual([...ids, added.id].sort());
});

test("editor must correct duplicate classification IDs before accepting other changes", () => {
  const f = fixture();
  const ids = f.catalog[0].editions[0].terms.map((term) => term.id);
  f.research.data!.editions[0].classification = {
    value: [...ids, ids[0]],
    reason,
  };
  f.research.data!.editions[0].venueName = { value: "New venue", reason };
  const plan = {
    ...f.plan,
    editions: [
      {
        editionKey: "2027",
        fields: {
          classification: { action: "accept" },
          venueName: { action: "accept" },
        },
      },
    ],
  };
  const invalid = prepare(f, plan);
  expect(invalid.operations).toEqual([]);
  expect(invalid.errors.at(-1)).toMatchObject({
    code: "invalid_plan",
    field: "editions.0.fields.classification",
  });
  const corrected = prepare(f, {
    ...plan,
    editions: [
      {
        ...plan.editions[0],
        fields: {
          ...plan.editions[0].fields,
          classification: {
            action: "set",
            value: ids,
            reason: "Deduplicated research list, preserving saved categories",
          },
        },
      },
    ],
  });
  expect(corrected.errors).toEqual([]);
  expect(corrected.operations).toContainEqual(
    expect.objectContaining({
      kind: "updateEdition",
      data: expect.objectContaining({ venueName: "New venue" }),
    }),
  );
  const applied = applyCatalogItem(f.client, corrected.operations);
  expect(
    applied.changes.some((change) =>
      change.changedFields.some((field) => field.field === "terms"),
    ),
  ).toBe(false);
  expect(
    readResearchEvent(f.client, f.event.id)!
      .editions[0].terms.map((term) => term.id)
      .sort(),
  ).toEqual([...ids].sort());
});

test("accept forbids copied values or reasons in the editor action", () => {
  const f = fixture();
  for (const extra of [{ value: "Copied" }, { reason: "Repeated" }]) {
    expect(
      editorPlanSchema.safeParse({
        ...f.plan,
        editions: [
          {
            editionKey: "2027",
            fields: { venueName: { action: "accept", ...extra } },
          },
        ],
      }).success,
    ).toBe(false);
  }
});

test("accept creates only an addressed research-backed new Edition", () => {
  const f = fixture();
  f.research.data!.editions = [
    {
      key: "2028",
      year: { value: 2028, reason: "New Edition year" },
      links: {},
      venueName: { value: null, reason },
      countryCode: { value: "PT", reason },
    },
  ];
  const edition = {
    editionKey: "2028",
    reason: "Announced new Edition",
    fields: { year: { action: "accept" } },
  };
  const result = prepare(f, { ...f.plan, editions: [edition] });
  expect(result.errors).toEqual([]);
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "createEdition",
      data: { editionKey: "2028", editionYear: 2028 },
    }),
  );
  expect(
    result.operations.some(
      (operation) => "id" in operation && operation.id === f.edition.id,
    ),
  ).toBe(false);
  for (const patch of [
    { editionKey: "unresearched" },
    { reason: undefined },
    { fields: { venueName: { action: "clear", reason } } },
    { fields: { countryCode: { action: "set", value: "ES", reason } } },
  ]) {
    const rejected = prepare(f, {
      ...f.plan,
      editions: [{ ...edition, ...patch }],
    });
    expect(rejected.operations).toEqual([]);
    expect(rejected.errors.at(-1)?.code).toBe("invalid_plan");
  }
});

test("add derives Event identity from research and requires a creation reason", () => {
  const f = fixture();
  delete f.research.data!.eventId;
  f.research.data!.summary = { value: "", reason };
  const input = { mode: "add" as const, actor: "test", dryRun: true };
  const validated = validateResearch(f.research, [], input);
  const run = (event: unknown) =>
    prepareEditorPlan(
      { ...f.plan, event, editions: [] },
      validated,
      [],
      input,
      f.vocabulary,
    );
  const result = run({ reason, fields: {} });
  expect(result.errors).toEqual([]);
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "createEvent",
      data: { canonicalName: "Editor Fest", slug: "editor-fest" },
    }),
  );
  expect(Object.values(result.explanations)).toContainEqual({
    canonical_name: [reason],
  });
  for (const fields of [undefined, { summary: { action: "clear", reason } }]) {
    const rejected = run(fields ? { reason, fields } : { fields: {} });
    expect(rejected.operations).toEqual([]);
    expect(rejected.errors.at(-1)?.code).toBe("invalid_plan");
  }
});
