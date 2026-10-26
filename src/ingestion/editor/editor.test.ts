import { generateFixtureLocation, fixtureLocationPlan } from "@/test/ingestion";
import { locationTextFields } from "../location/contracts";
import type { MaterializedLocation } from "../location/validate";
import { buildLocationInput } from "../location/input";
import { afterEach, expect, test, vi } from "vitest";
import { Agent } from "@mastra/core/agent";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchEvent } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import { editorPlanSchema, readyEditorPlanSchema } from "./contracts";
import { editorModelOutputSchema, normalizeEditorWire } from "./wire";

test("provider editor schema requires both nullable Edition slots", () => {
  const schema = editorModelOutputSchema();
  expect(schema.type).toBe("object");
  expect(schema).not.toHaveProperty("anyOf");
  expect(schema.required).toEqual(
    expect.arrayContaining([
      "event",
      "previousEdition",
      "currentOrNextEdition",
      "unresolved",
    ]),
  );
  expect(schema.properties).not.toHaveProperty("editions");
  const f = fixture();
  expect(
    editorPlanSchema.parse(
      normalizeEditorWire({
        ...f.plan,
        reason: null,
        event: { fields: {}, reason: null },
        currentOrNextEdition: { editionKey: "2027", fields: {}, reason: null },
      }),
    ),
  ).toEqual(f.plan);
  expect(
    readyEditorPlanSchema.parse(
      normalizeEditorWire({ ...f.plan, currentOrNextEdition: null }),
    ).currentOrNextEdition,
  ).toBeNull();
});

test("rejected transport drops only empty branch placeholders", () => {
  const rejected = {
    status: "rejected",
    reason: "Wrong festival",
    event: null,
    previousEdition: null,
    currentOrNextEdition: null,
    unresolved: [],
  };
  expect(editorPlanSchema.parse(normalizeEditorWire(rejected))).toEqual({
    status: "rejected",
    reason: "Wrong festival",
  });
  for (const patch of [
    { editions: [] },
    { previousEdition: {} },
    { currentOrNextEdition: {} },
    { unresolved: [{ message: "Unexpected question" }] },
    { event: { fields: {} } },
    { unresolved: null },
  ]) {
    expect(
      editorPlanSchema.safeParse(normalizeEditorWire({ ...rejected, ...patch }))
        .success,
    ).toBe(false);
  }
});

test("ready output requires both Edition slots and rejects old arrays", () => {
  const f = fixture();
  for (const slot of [
    "previousEdition",
    "currentOrNextEdition",
    "unresolved",
  ]) {
    expect(
      editorPlanSchema.safeParse({ ...f.plan, [slot]: undefined }).success,
    ).toBe(false);
  }
  expect(
    editorPlanSchema.safeParse({ ...f.plan, unresolved: null }).success,
  ).toBe(false);
  expect(editorPlanSchema.safeParse({ ...f.plan, editions: [] }).success).toBe(
    false,
  );
});
import {
  prepareEditorPlan,
  prepareCatalogPlan,
  validateResearch,
} from "./prepare";
import { runCatalogResearch } from "../workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../runtime/budget";
import {
  editionSlotNames,
  type ResearchCandidate,
} from "../research/contracts";

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
    displayName: "Old venue",
  });
  for (const term of terms) {
    fx.assignTerm(edition, term);
  }
  const catalog = [readResearchEvent(client, event.id)!];
  const vocabulary = terms.map((term) => ({
    id: term.id,
    facet: term.facet,
    slug: term.slug,
    parentId: term.parentId,
  }));
  const input = {
    mode: "refresh" as const,
    scope: "full" as "current" | "full",
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
      previousEdition: null,
      currentOrNextEdition: {
        key: "2027",
        displayName: { value: null, reason },
        links: {},
      },
    },
    errors: [],
    unresolved: [],
  };
  const plan = {
    status: "ready" as const,
    event: { fields: {} },
    previousEdition: null,
    currentOrNextEdition: { editionKey: "2027", fields: {} },
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
test("Location receives the writer's default status for a new Edition", () => {
  const f = fixture();
  f.research.data!.currentOrNextEdition!.key = "2028";
  f.plan.currentOrNextEdition.editionKey = "2028";
  const prepared = prepareEditorPlan(
    {
      ...f.plan,
      currentOrNextEdition: {
        ...f.plan.currentOrNextEdition,
        reason: "The organizer announced a new Edition",
      },
    },
    validateResearch(f.research, f.catalog, f.input),
    f.catalog,
    f.input,
    f.vocabulary,
  );
  expect(prepared.errors).toEqual([]);
  const location = buildLocationInput(
    prepared.editorPlan!,
    prepared.candidate!.data!,
    {
      catalog: f.catalog,
      terms: f.vocabulary,
      knownLinks: [],
      currentDate: "2026-10-25T12:00:00Z",
    },
    f.input,
  );
  expect(location.currentOrNextEdition).toMatchObject({
    editionKey: "2028",
    saved: null,
    scheduleStatus: "announced",
  });
});

function prepare(f: ReturnType<typeof fixture>, plan: unknown) {
  const prepared = prepareEditorPlan(
    plan,
    validateResearch(f.research, f.catalog, f.input),
    f.catalog,
    f.input,
    f.vocabulary,
  );
  if (!prepared.editorPlan) {
    return prepared;
  }
  return prepareCatalogPlan(prepared, f.catalog, f.input, f.vocabulary, {
    slots: Object.fromEntries(
      ["previousEdition", "currentOrNextEdition"]
        .filter((slot) => !!prepared.editorPlan![slot as "previousEdition"])
        .map((slot) => [
          slot,
          {
            ...Object.fromEntries(
              locationTextFields.map((field) => [
                field,
                { action: "keep", reason: "Preserve" },
              ]),
            ),
            coordinates: { action: "keep", reason: "Preserve" },
          },
        ]),
    ),
    donors: [],
    unresolved: [],
  } as MaterializedLocation);
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
        previousEdition: null,
        currentOrNextEdition: {
          editionKey: "2027",
          fields: { displayName: action },
        },
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
      previousEdition: f.plan.currentOrNextEdition,
      currentOrNextEdition: f.plan.currentOrNextEdition,
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
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        displayName: null,
        tickets: { action: "set", value: null, reason },
      },
    },
  };
  const normalized = normalizeEditorWire(raw) as typeof raw;
  expect(normalized.currentOrNextEdition!.fields).not.toHaveProperty(
    "displayName",
  );
  expect(normalized.currentOrNextEdition!.fields.tickets.value).toBeNull();
  expect(editorPlanSchema.safeParse(normalized).success).toBe(false);
});

test("clear changes only its field and eligible kept content still publishes", () => {
  const f = fixture();
  const plan = {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { displayName: { action: "clear", reason } },
    },
  };
  const prepared = prepare(f, plan);
  expect(prepared.errors).toEqual([]);
  const applied = applyCatalogItem(f.client, prepared.operations, {
    dryRun: true,
  });
  expect(
    applied.changes.some((change) =>
      change.changedFields.some(
        (field) => field.field === "display_name" && field.newValue === null,
      ),
    ),
  ).toBe(true);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0].displayName).toBe(
    "Old venue",
  );
  expect(
    prepare(f, f.plan).operations.some((op) => op.kind === "publishEdition"),
  ).toBe(true);
  expect(
    prepare(f, { ...f.plan, previousEdition: null, currentOrNextEdition: null })
      .operations,
  ).toEqual([]);
});

test("final target, scope, country, term and creation checks reject the entire plan", () => {
  const f = fixture();
  for (const plan of [
    {
      ...f.plan,
      event: null,
      previousEdition: null,
      currentOrNextEdition: null,
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
      previousEdition: null,
      currentOrNextEdition: { ...identity, fields: {} },
    })),
    {
      ...f.plan,
      previousEdition: null,
      currentOrNextEdition: { editionKey: "unknown", fields: {} },
    },
    {
      ...f.plan,
      previousEdition: null,
      currentOrNextEdition: {
        editionKey: "2027",
        fields: { countryCode: { action: "clear", reason } },
      },
    },
    {
      ...f.plan,
      previousEdition: null,
      currentOrNextEdition: {
        editionKey: "2027",
        fields: {
          classification: { action: "set", value: ["unknown"], reason },
        },
      },
    },
  ]) {
    const result = prepare(f, plan);
    expect(result.operations).toEqual([]);
    expect(result.errors.at(-1)?.code).toBe("invalid_plan");
  }
  const swapped = prepare(f, {
    ...f.plan,
    previousEdition: f.plan.currentOrNextEdition,
    currentOrNextEdition: null,
  });
  expect(swapped.operations).toEqual([]);
  expect(swapped.errors.at(-1)?.message).toBe(
    "Editor key must match the same research slot",
  );
});

test("swapped non-null roles reject all actions", () => {
  const f = fixture();
  f.research.data!.previousEdition = { key: "2026", links: {} };
  const result = prepare(f, {
    ...f.plan,
    previousEdition: { editionKey: "2027", fields: {} },
    currentOrNextEdition: { editionKey: "2026", fields: {} },
  });
  expect(result.operations).toEqual([]);
  expect(result.errors.at(-1)?.field).toBe("previousEdition.editionKey");
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
    schemaVersion: 7,
    locationResponse: null,
    locationStatus: "not_run",
    locationPromptVersion: "catalog-location-v1",
    locationModelVersion: "fixture",
    geocoding: { observations: [], points: [] },
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
  f.research.data!.currentOrNextEdition!.countryCode = { value: null, reason };
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
  delete f.research.data!.currentOrNextEdition!.countryCode;
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
  Object.assign(research.data!, {
    previousEdition: null,
    currentOrNextEdition: null,
  });
  const result = await runCatalogResearch(
    { mode: "add", name: "New Fest", actor: "test", dryRun: true },
    {
      client: f.client,
      generateCandidate: async () => research,
      generateEditor: async () => ({
        status: "ready",
        event: null,
        previousEdition: null,
        currentOrNextEdition: null,
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

test("research, editor and Location share the fixed run date and model settings", async () => {
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
      object:
        this.id === "festival-location"
          ? fixtureLocationPlan(JSON.parse(prompt as string))
          : editing
            ? f.plan
            : f.research,
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
  expect(result.errors).toEqual([]);
  expect(result).not.toHaveProperty("usage");
  expect(prompts).toHaveLength(3);
  expect(prompts[0].currentDate).toBe(prompts[1].currentDate);
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
    previousEdition: null,
    currentOrNextEdition: null,
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
    Object.assign(f.research.data!, {
      previousEdition: null,
      currentOrNextEdition: null,
    });
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

test.each(["dates", "displayName", "tickets", "classification", "links"])(
  "editor cannot extract %s from summaries without same-Edition findings",
  (field) => {
    const f = fixture();
    Object.assign(f.research.data!, {
      previousEdition: null,
      currentOrNextEdition: null,
    });
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
      displayName: { action: "clear", reason },
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
      previousEdition: null,
      currentOrNextEdition: {
        editionKey: "2027",
        fields: { [field]: actions[field as keyof typeof actions] },
      },
    });
    expect(result.operations).toEqual([]);
    expect(result.errors.at(-1)).toMatchObject({ code: "invalid_plan" });
    expect(
      prepare(f, { ...f.plan, currentOrNextEdition: null }).errors,
    ).toEqual([]);
  },
);

test("a finding for another field or Edition cannot authorize a mutation", () => {
  const f = fixture();
  f.input.scope = "full";
  f.research.data!.previousEdition = {
    key: "2028",
    locality: { value: "Sydney", reason },
    links: {},
  };
  const result = prepare(f, {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { locality: { action: "set", value: "Sydney", reason } },
    },
  });
  expect(result.errors.at(-1)?.field).toBe("currentOrNextEdition.fields");
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
  f.research.data!.currentOrNextEdition!.tickets = {
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
  Object.assign(wire.data!.currentOrNextEdition!.tickets!.value.variants[0], {
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
      generateLocation: generateFixtureLocation,
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
  data.currentOrNextEdition!.displayName = {
    value: "New venue",
    reason: "Organizer venue",
  };
  data.currentOrNextEdition!.dates = {
    value: { startsOn: "2027-07-10", endsOn: "2027-07-12", state: "confirmed" },
    reason: "Organizer dates",
  };
  data.currentOrNextEdition!.tickets = {
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
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        displayName: { action: "accept" },
        dates: { action: "accept" },
        tickets: { action: "accept" },
      },
    },
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
        displayName: "New venue",
        startsOn: "2027-07-10",
        endsOn: "2027-07-12",
      }),
    }),
  );
  expect(result.operations).toContainEqual(
    expect.objectContaining({
      kind: "replacePriceBlock",
      priceDetails: data.currentOrNextEdition!.tickets!.value.variants,
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
      delete f.research.data!.currentOrNextEdition!.displayName;
    }
    if (variant === "wrong-edition") {
      f.research.data!.currentOrNextEdition!.key = "2026";
    }
    if (variant === "incompatible") {
      f.research.data!.summary = { value: "", reason };
      f.research.data!.currentOrNextEdition!.displayName = {
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
      previousEdition: null,
      currentOrNextEdition: {
        editionKey: "2027",
        fields: { displayName: { action: "accept" } },
      },
    });
    expect(result.operations).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid_plan" }),
    );
  },
);

test("classification accept preserves saved terms, adds a new term and retains the full reason", () => {
  const f = fixture();
  const ids = f.catalog[0].editions[0].terms.map((term) => term.id);
  const added = f.fx.term({ facet: "topic", slug: "new-category" });
  f.vocabulary.push({
    id: added.id,
    facet: added.facet,
    slug: added.slug,
    parentId: added.parentId,
  });
  const classificationReason = "a".repeat(501);
  f.research.data!.currentOrNextEdition!.classification = {
    value: [...ids, added.id],
    reason: classificationReason,
  };
  f.research.data!.currentOrNextEdition!.displayName = {
    value: "New venue",
    reason,
  };
  const result = prepare(f, {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        classification: { action: "accept" },
        displayName: { action: "accept" },
      },
    },
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
      data: expect.objectContaining({ displayName: "New venue" }),
    }),
  );
  applyCatalogItem(f.client, result.operations);
  expect(
    readResearchEvent(f.client, f.event.id)!
      .editions[0].terms.map((term) => term.id)
      .sort(),
  ).toEqual([...ids, added.id].sort());
});

test("keep preserves saved classification despite a different research finding", () => {
  const f = fixture();
  const savedTerms = f.catalog[0].editions[0].terms;
  f.research.data!.currentOrNextEdition!.classification = {
    value: [],
    reason: "Research proposes removing all terms",
  };
  const result = prepare(f, {
    ...f.plan,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        classification: {
          action: "keep",
          reason: "The saved classification remains supported",
        },
      },
    },
  });
  expect(result.errors).toEqual([]);
  expect(result.operations.some((op) => op.kind === "replaceTerms")).toBe(
    false,
  );
  applyCatalogItem(f.client, result.operations);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0].terms).toEqual(
    savedTerms,
  );
});

test("editor must correct duplicate classification IDs before accepting other changes", () => {
  const f = fixture();
  const ids = f.catalog[0].editions[0].terms.map((term) => term.id);
  f.research.data!.currentOrNextEdition!.classification = {
    value: [...ids, ids[0]],
    reason,
  };
  f.research.data!.currentOrNextEdition!.displayName = {
    value: "New venue",
    reason,
  };
  const plan = {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        classification: { action: "accept" },
        displayName: { action: "accept" },
      },
    },
  };
  const invalid = prepare(f, plan);
  expect(invalid.operations).toEqual([]);
  expect(invalid.errors.at(-1)).toMatchObject({
    code: "invalid_plan",
    field: "currentOrNextEdition.fields.classification",
  });
  const corrected = prepare(f, {
    ...plan,
    previousEdition: null,
    currentOrNextEdition: {
      ...plan.currentOrNextEdition!,
      fields: {
        ...plan.currentOrNextEdition!.fields,
        classification: {
          action: "set",
          value: ids,
          reason: "Deduplicated research list, preserving saved categories",
        },
      },
    },
  });
  expect(corrected.errors).toEqual([]);
  expect(corrected.operations).toContainEqual(
    expect.objectContaining({
      kind: "updateEdition",
      data: expect.objectContaining({ displayName: "New venue" }),
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
        previousEdition: null,
        currentOrNextEdition: {
          editionKey: "2027",
          fields: { displayName: { action: "accept", ...extra } },
        },
      }).success,
    ).toBe(false);
  }
});

test("accept creates only an addressed research-backed new Edition", () => {
  const f = fixture();
  Object.assign(f.research.data!, {
    previousEdition: null,
    currentOrNextEdition: {
      key: "2028",
      year: { value: 2028, reason: "New Edition year" },
      links: {},
      displayName: { value: null, reason },
      countryCode: { value: "PT", reason },
    },
  });
  const edition = {
    editionKey: "2028",
    reason: "Announced new Edition",
    fields: { year: { action: "accept" } },
  };
  const result = prepare(f, {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: edition,
  });
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
    { fields: { displayName: { action: "clear", reason } } },
    { fields: { countryCode: { action: "set", value: "ES", reason } } },
  ]) {
    const rejected = prepare(f, {
      ...f.plan,
      previousEdition: null,
      currentOrNextEdition: { ...edition, ...patch },
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
      { ...f.plan, event, previousEdition: null, currentOrNextEdition: null },
      validated,
      [],
      input,
      f.vocabulary,
    );
  const editor = run({ reason, fields: {} });
  expect(editor.operations).toEqual([]);
  const result = prepareCatalogPlan(editor, [], input, f.vocabulary, {
    slots: {},
    donors: [],
    unresolved: [],
  });
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

test("current editor preserves history by omitting preservation-only plan entries", () => {
  const f = fixture();
  f.input.scope = "current";
  const history = f.fx.edition(f.event, {
    editionKey: "2026",
    editionYear: 2026,
    countryCode: "PT",
    displayName: "Historical venue",
  });
  f.catalog[0] = readResearchEvent(f.client, f.event.id)!;
  const before = f.catalog[0].editions.find((e) => e.id === history.id);
  f.research.data!.currentOrNextEdition!.displayName = {
    value: "New venue",
    reason,
  };
  const plan = {
    ...f.plan,
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { displayName: { action: "accept" } },
    },
  };
  const invalid = prepare(f, {
    ...plan,
    previousEdition: { editionKey: "2026", fields: {} },
    currentOrNextEdition: plan.currentOrNextEdition,
  });
  expect(invalid.errors.at(-1)?.message).toBe(
    "Editor key must match the same research slot",
  );
  const prepared = prepare(f, plan);
  expect(prepared.errors).toEqual([]);
  applyCatalogItem(f.client, prepared.operations);
  const after = readResearchEvent(f.client, f.event.id)!;
  expect(after.editions.find((e) => e.id === history.id)).toEqual(before);
  expect(after.editions.find((e) => e.id === f.edition.id)?.displayName).toBe(
    "New venue",
  );
});

function classificationFixture(action: "accept" | "set" = "accept") {
  const f = fixture();
  const baseline = f.vocabulary.map((term) => term.id);
  const broad = f.fx.term({ facet: "genre", slug: "test-broad" });
  const parent = f.fx.term({
    facet: "genre",
    slug: "test-parent",
    parentId: broad.id,
  });
  const leaf = f.fx.term({
    facet: "genre",
    slug: "test-leaf",
    parentId: parent.id,
  });
  const sibling = f.fx.term({
    facet: "genre",
    slug: "test-sibling",
    parentId: parent.id,
  });
  f.vocabulary.push(broad, parent, leaf, sibling);
  const ids = [...baseline, leaf.id, parent.id, broad.id, sibling.id];
  f.research.data!.currentOrNextEdition!.classification = {
    value: ids,
    reason: "Inspected programme supports these genres",
  };
  const plan = {
    ...f.plan,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: {
        classification:
          action === "accept" ? { action } : { action, value: ids, reason },
      },
    },
  };
  const deps = {
    client: f.client,
    generateCandidate: async () => f.research,
    generateEditor: async () => plan,
    generateLocation: generateFixtureLocation,
  };
  return {
    ...f,
    plan,
    deps,
    broad,
    parent,
    normalizedIds: [...baseline, leaf.id, sibling.id],
  };
}

test.each(["accept", "set"] as const)(
  "%s classification removes deep ancestors and preserves siblings without changing inputs",
  (action) => {
    const f = classificationFixture(action);
    const raw = structuredClone({ research: f.research, plan: f.plan });
    const prepared = prepare(f, f.plan);
    expect(prepared.errors).toEqual([]);
    expect(prepared.operations).toContainEqual(
      expect.objectContaining({
        kind: "replaceTerms",
        termIds: f.normalizedIds,
      }),
    );
    expect({ research: f.research, plan: f.plan }).toEqual(raw);
  },
);

test("classification preview explains normalization and preserves stored data and raw responses", async () => {
  const f = classificationFixture();
  const before = readResearchEvent(f.client, f.event.id);
  const raw = structuredClone({ research: f.research, plan: f.plan });
  const preview = await runCatalogResearch(f.input, f.deps);
  expect(preview.errors).toEqual([]);
  const change = preview.changes.find((c) => c.field === "terms")!;
  expect(change.newValue).toEqual(expect.arrayContaining(f.normalizedIds));
  expect(change.newValue).toHaveLength(f.normalizedIds.length);
  for (const ancestor of [f.broad, f.parent]) {
    expect(change.explanations.join(" ")).toContain(
      "Removed ancestor " + ancestor.id + "; retained descendant",
    );
  }
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
  expect(preview.modelResponse!.object).toEqual(raw.research);
  expect(preview.editorResponse!.object).toEqual(raw.plan);
});

test("classification commit saves normalized terms and a repeat adds no audit changes", async () => {
  const f = classificationFixture();
  const raw = structuredClone({ research: f.research, plan: f.plan });
  const input = { ...f.input, dryRun: false };
  const applied = await runCatalogResearch(input, f.deps);
  expect(applied.errors).toEqual([]);
  const saved = readResearchEvent(f.client, f.event.id)!.editions.find(
    (edition) => edition.id === f.edition.id,
  )!;
  expect(saved.terms.map((term) => term.id).sort()).toEqual(
    [...f.normalizedIds].sort(),
  );
  const changesBefore = f.client
    .prepare("SELECT count(*) AS count FROM catalog_changes")
    .get();
  const noop = await runCatalogResearch(input, f.deps);
  expect(noop.errors).toEqual([]);
  expect(noop.changes).toEqual([]);
  expect(
    f.client.prepare("SELECT count(*) AS count FROM catalog_changes").get(),
  ).toEqual(changesBefore);
  expect({ research: f.research, plan: f.plan }).toEqual(raw);
});

test("classification preserves a broad term when no descendant is selected", () => {
  const f = fixture();
  const broad = f.fx.term({ facet: "genre", slug: "test-broad" });
  f.vocabulary.push(broad);
  const ids = f.vocabulary.map((term) => term.id);
  f.research.data!.currentOrNextEdition!.classification = {
    value: ids,
    reason,
  };
  const plan = {
    ...f.plan,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { classification: { action: "accept" } },
    },
  };
  const prepared = prepare(f, plan);
  expect(prepared.errors).toEqual([]);
  expect(prepared.operations).toContainEqual(
    expect.objectContaining({ kind: "replaceTerms", termIds: ids }),
  );
});

test("classification rejects unknown and duplicate terms before normalization", () => {
  const f = fixture();
  const baseline = f.vocabulary.map((term) => term.id);
  const topic = f.vocabulary.find((term) => term.facet === "topic")!;
  const plan = {
    ...f.plan,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { classification: { action: "accept" } },
    },
  };
  for (const ids of [
    [...baseline, "missing"],
    [...baseline, topic.id],
  ]) {
    f.research.data!.currentOrNextEdition!.classification = {
      value: ids,
      reason,
    };
    const prepared = prepare(f, plan);
    expect(prepared.operations).toEqual([]);
    expect(prepared.errors.at(-1)?.code).toBe("invalid_plan");
  }
});

test.each(editionSlotNames)(
  "%s rejects an event type conflict and allows a supported correction",
  (slot) => {
    const f = fixture();
    const festival = f.fx.existingTerm("event_type", "festival");
    const gathering = f.fx.existingTerm("event_type", "gathering");
    const ids = f.vocabulary.map((term) => term.id);
    f.vocabulary.push(gathering);
    f.research.data!.previousEdition = null;
    f.research.data!.currentOrNextEdition = null;
    f.research.data![slot] = {
      key: "2027",
      links: {},
      classification: {
        value: [...ids, gathering.id],
        reason: "The organizer describes a festival and community gathering",
      },
    };
    const plan = (classification: unknown) => ({
      ...f.plan,
      previousEdition: null,
      currentOrNextEdition: null,
      [slot]: {
        editionKey: "2027",
        fields: { classification },
      },
    });
    const rejected = prepare(f, plan({ action: "accept" }));
    expect(rejected.errors).toEqual([
      {
        code: "invalid_plan",
        stage: "validation",
        field: `${slot}.fields.classification`,
        message: `Only one event_type term allowed (limit: 1); received: ${festival.id}, ${gathering.id}`,
      },
    ]);
    expect(rejected.operations).toEqual([]);
    const correctionReason =
      "The organizer calls it a festival; community wording does not establish a participatory gathering";
    const prepared = prepare(
      f,
      plan({ action: "set", value: ids, reason: correctionReason }),
    );
    expect(prepared.errors).toEqual([]);
    const replacement = prepared.operations.find(
      (operation) => operation.kind === "replaceTerms",
    )!;
    expect(replacement).toMatchObject({
      kind: "replaceTerms",
      id: f.edition.id,
      termIds: ids,
    });
    expect(prepared.explanations[replacement.operationKey].terms).toEqual([
      correctionReason,
    ]);
  },
);

test("classification rejects two format terms before removing ancestors", () => {
  const f = fixture();
  const format = f.vocabulary.find((term) => term.facet === "format")!;
  const child = f.fx.term({
    facet: "format",
    slug: "test-format-child",
    parentId: format.id,
  });
  f.vocabulary.push(child);
  f.research.data!.currentOrNextEdition!.classification = {
    value: f.vocabulary.map((term) => term.id),
    reason,
  };
  const plan = {
    ...f.plan,
    currentOrNextEdition: {
      editionKey: "2027",
      fields: { classification: { action: "accept" } },
    },
  };
  const prepared = prepare(f, plan);
  expect(prepared.operations).toEqual([]);
  expect(prepared.errors.at(-1)?.code).toBe("invalid_plan");
});
