import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { readResearchCatalog } from "@/catalog/read/research";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  approveFixtureReview,
  createFixtureIngestionWorkflow,
  fixtureChecks,
  fixtureDependencies,
  fixtureLocationPlan,
  fixtureTargets,
  runFixtureResearch,
  set,
} from "@/test/ingestion";
import {
  modelReply,
  modelWireFixture,
  providerPrompt,
  providerRole,
  type ProviderRequest,
} from "@/test/ingestion-provider";
import type { ResearchDependencies } from "./contracts";
import { topics } from "./evidence/contracts";
import type { LocationInput } from "./roles/location/input";
import type { LocationOutput } from "./roles/location/contracts";
import type { ReviewDecision, ReviewPath } from "./roles/editor/contracts";
import { ProposalRepairs } from "./repairs";
import type { GenerateRole, Role } from "./roles/invoke";
import { DEFAULT_RESEARCH_LIMITS } from "./runtime/budget";
import { createWorkflowStorage } from "./runtime/workflow-storage";

const sourceUrl = "https://example.org/";
const ticketsPath = "currentOrNextEdition.fields.tickets";
const locationPath = "currentOrNextEdition.fields.location";
const datesPath = "currentOrNextEdition.fields.dates";
const marker = "PRIVATE_GEOCODE_TOOL_CALL";

function reply(body: ProviderRequest, value: unknown) {
  return modelReply(
    JSON.stringify(
      modelWireFixture(value, body.response_format.json_schema.schema),
    ),
  );
}

function review(
  prompt: { reviewPaths: ReviewPath[] },
  ...overrides: ReviewDecision[]
) {
  const overridden = new Set(overrides.map(({ path }) => path));
  return {
    decisions: [
      ...approveFixtureReview(prompt.reviewPaths).decisions.filter(
        ({ path }) => !overridden.has(path),
      ),
      ...overrides,
    ],
  };
}

function editorReply(
  answer: (
    prompt: ReturnType<typeof providerPrompt>,
    index: number,
  ) => ReturnType<typeof review>,
) {
  let index = 0;
  return vi.fn<GenerateRole>(async (_role, raw) =>
    answer(JSON.parse(raw), index++),
  );
}

function tickets(block: unknown, unresolved: unknown[] = []) {
  return {
    currentOrNextEdition: { tickets: block },
    checks: fixtureChecks(["currentTickets"]),
    unresolved,
  };
}

function price(amount: number, currency: "DKK" | "EUR") {
  return set({
    variants: [{ label: "Full pass", amount, currency }],
    basePrice: {
      kind: "exact",
      currency,
      minAmount: amount,
      maxAmount: amount,
      coverage: "full_programme",
    },
  });
}

function toolResult(body: ProviderRequest, id: string) {
  return String(
    body.messages.find(({ tool_call_id }) => tool_call_id === id)?.content,
  );
}

type Handler = (
  body: ProviderRequest,
  index: number,
  prompt: ReturnType<typeof providerPrompt>,
  signal?: AbortSignal | null,
) => Response | Promise<Response>;

beforeEach(async () => {
  const sourceDirectory = await mkdtemp(join(tmpdir(), "eventroam-repair-"));
  vi.stubEnv("CATALOG_SOURCE_DIRECTORY", sourceDirectory);
  return async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await rm(sourceDirectory, { recursive: true, force: true });
  };
});

function fixture(page: string, { name = "Example Fest", quote = page } = {}) {
  const { client } = testDatabase();
  const f = testFixtures(client);
  const event = f.event({ canonicalName: name });
  f.link({ event }, { kind: "official_site", official: true, url: sourceUrl });
  const roles = [
    "reader",
    "research",
    "general",
    "tickets",
    "classification",
    "links",
    "editor",
  ] as const;
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "test",
    dryRun: false,
  };
  function model(
    nativeRole: Role,
    handler: Handler,
    answers: Parameters<typeof fixtureDependencies>[0] = {},
  ) {
    const defaults = fixtureDependencies({
      reader: {
        overview: name,
        coverage: { found: [], notPublished: [] },
        topics,
        statedYears: [],
        limitations: [],
        evidence: [{ quote, topics }],
      },
      ...answers,
    });
    const requests: ProviderRequest[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as ProviderRequest;
      expect(providerRole(body)).toBe(nativeRole);
      requests.push(body);
      return handler(
        body,
        requests.length - 1,
        providerPrompt(body),
        init?.signal,
      );
    });
    const deps: ResearchDependencies = {
      client,
      todayUtc: "2026-11-01",
      config: {
        apiKey: "fixture",
        model: "fixture/model",
        limits: DEFAULT_RESEARCH_LIMITS,
      },
      observabilityStore: null,
      readPage: async (url, context) => ({
        ...(await defaults.readPage(url, context)),
        markdown: page,
      }),
      generateRoles: Object.fromEntries(
        roles
          .filter((role) => role !== nativeRole)
          .map((role) => [role, defaults.generateRole]),
      ),
      generateLocation:
        nativeRole === "location" ? undefined : defaults.generateLocation,
    };
    return {
      deps,
      requests,
      run: (overrides?: Partial<ResearchDependencies>) =>
        runFixtureResearch(input, { ...deps, ...overrides }),
    };
  }
  return {
    client,
    f,
    event,
    model,
    saved: () => readResearchCatalog(client)[0],
  };
}

function capturedPage(festival: "roskilde" | "wacken") {
  return readFile(
    new URL(`./evals/cases/${festival}/tickets.md`, import.meta.url),
    "utf8",
  );
}

it("repairs Wacken tickets before the first Editor review", async () => {
  const page = await capturedPage("wacken");
  const quote = "Preis: 364 € zzgl. 2 € Ticketgebühr";
  const f = fixture(page, { name: "Wacken Open Air", quote });
  f.f.edition(f.event, { editionKey: "2027", editionYear: 2027 });
  const invalid = set({ variants: [], basePrice: null }, "Empty offer list");
  const editor = editorReply((prompt) => {
    expect(requests).toHaveLength(2);
    expect(prompt.reviewPaths).toContainEqual({
      path: ticketsPath,
      required: true,
      allowed: ["approve", "reject", "return"],
    });
    return review(prompt);
  });
  const { run, requests } = f.model(
    "tickets",
    (body, index, prompt) => {
      if (!index) {
        return reply(body, tickets(invalid));
      }
      expect(prompt.groups).toMatchObject([
        {
          path: ticketsPath,
          note: expect.stringContaining("empty offer list"),
          original: invalid,
        },
      ]);
      expect(JSON.stringify(body.messages.slice(0, -1))).toContain(
        invalid.reason,
      );
      return reply(body, tickets(price(364, "EUR")));
    },
    { editor },
  );
  const result = await run();
  expect(result.errors).toEqual([]);
  expect(editor).toHaveBeenCalledOnce();
  expect(result.repairs).toMatchObject([
    {
      path: ticketsPath,
      trigger: "validation",
      target: { eventId: f.event.id, editionKey: "2027" },
      decision: { decision: "approve" },
      evidence: [{ quote }],
    },
  ]);
  expect(f.saved().editions[0].priceDetails).toMatchObject([
    { amount: 364, currency: "EUR" },
  ]);
});

it("returns Roskilde tickets with the exact note and preserves the approved link", async () => {
  const page = await capturedPage("roskilde");
  const f = fixture(page, {
    name: "Roskilde Festival",
    quote: page.split("\n")[1],
  });
  const note =
    "  Check s1, Smart Ticket: 524 kr. om måneden plus 100,- i gebyr. Keep the supported full pass.\n";
  const link = "https://www.roskilde-festival.dk/da/billetter";
  const question = {
    field: ticketsPath,
    message: "The price qualification remains open.",
  };
  const editor = editorReply((prompt, index) => {
    if (!index) {
      return review(prompt, { path: ticketsPath, decision: "return", note });
    }
    expect(prompt.reviewPaths).toEqual([
      {
        path: ticketsPath,
        required: true,
        allowed: ["approve", "reject", "return"],
      },
    ]);
    expect(prompt.prepared).not.toHaveProperty("plan");
    return review(prompt);
  });
  const { run } = f.model(
    "tickets",
    (body, index, prompt) => {
      const fullPass = price(2650, "DKK");
      if (index === 0) {
        fullPass.value.variants.push({
          label: "Smart Ticket instalment",
          amount: 524,
          currency: "DKK",
        });
        return reply(body, tickets(fullPass));
      }
      expect(prompt.groups).toEqual([
        expect.objectContaining({ path: ticketsPath, note }),
      ]);
      expect(JSON.stringify(body.messages.slice(0, -1))).toContain(
        "Smart Ticket instalment",
      );
      return reply(body, tickets(fullPass, [question]));
    },
    {
      editor,
      links: {
        event: { socials: {} },
        currentOrNextEdition: { tickets: set(link) },
        checks: fixtureChecks(["eventLinks", "currentLinks"]),
        omitted: [],
        unresolved: [],
      },
    },
  );
  const result = await run();
  expect(result.errors).toEqual([]);
  expect(editor).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({
    researchStatus: "partial",
    repairs: [{ path: ticketsPath, note, trigger: "editor" }],
  });
  expect(result.unresolved).toContainEqual({
    message: `currentTickets: ${question.message}`,
  });
  const [edition] = f.saved().editions;
  expect(edition.links).toContainEqual(expect.objectContaining({ url: link }));
  expect(edition.priceDetails).toMatchObject([
    { amount: 2650, currency: "DKK" },
  ]);
});

it("shares three ticket returns between validation and Editor", async () => {
  const quote = "Full pass EUR 130.";
  const f = fixture(`Example Fest 2027. ${quote}`);
  const citationId = "s1-repair-1";
  const revisedPrice = (amount: number) => ({
    ...price(amount, "EUR"),
    evidenceIds: [citationId],
  });
  const question = {
    field: ticketsPath,
    message: "The full pass price remains unconfirmed.",
  };
  const editor = editorReply((prompt, index) => {
    const path = prompt.reviewPaths.find(
      (entry: ReviewPath) => entry.path === ticketsPath,
    );
    expect(path).toEqual({
      path: ticketsPath,
      required: true,
      allowed:
        index < 2 ? ["approve", "reject", "return"] : ["approve", "reject"],
    });
    if (index > 0) {
      expect(prompt.reviewPaths).toEqual([path]);
      expect(prompt.evidence).toEqual([
        expect.objectContaining({ id: citationId, quote }),
      ]);
      expect(prompt.returnedGroups).toMatchObject([
        { path: ticketsPath, proposal: { evidenceIds: [citationId] } },
      ]);
      expect(prompt.repairs.slice(1)).toHaveLength(index);
      for (const repair of prompt.repairs.slice(1)) {
        expect(repair.evidenceIds).toEqual([citationId]);
        expect(repair).not.toHaveProperty("evidence");
      }
    }
    return index < 2
      ? review(prompt, {
          path: ticketsPath,
          decision: "return",
          note: `Use the saved price. Review ${index + 1}.`,
        })
      : review(prompt);
  });
  const { run, requests } = f.model(
    "tickets",
    (body, index, prompt) => {
      if (index === 0) {
        return reply(body, tickets(set({ variants: [], basePrice: null })));
      }
      if (index === 1) {
        return reply(body, tickets(null, [question]));
      }
      expect(prompt.groups).toMatchObject([
        {
          path: ticketsPath,
          original: index === 4 ? revisedPrice(120) : null,
          note: `Use the saved price. Review ${index === 4 ? 2 : 1}.`,
        },
      ]);
      if (index === 2) {
        return modelReply(null, {
          id: "cite-price",
          name: "citeSavedPassage",
          args: { sourceId: "s1", quote },
        });
      }
      if (index === 3) {
        expect(toolResult(body, "cite-price")).toContain(citationId);
      }
      return reply(body, tickets(revisedPrice(index === 3 ? 120 : 130)));
    },
    { editor },
  );
  const result = await run();
  expect(result.errors).toEqual([]);
  expect(requests).toHaveLength(5);
  expect(editor).toHaveBeenCalledTimes(3);
  expect(result.repairs).toMatchObject([
    { trigger: "validation", omissionReason: question.message },
    { trigger: "editor", evidence: [{ id: citationId, quote }] },
    { trigger: "editor", evidence: [{ id: citationId, quote }] },
  ]);
  expect(result.researchStatus).toBe("success");
  expect(result.unresolved).toEqual([]);
  expect(f.saved().editions[0].priceDetails).toMatchObject([
    { amount: 130, currency: "EUR" },
  ]);
});

it("revises one of two Location slots with a new venue citation", async () => {
  const quote = "The venue is Vale do Tejo.";
  const editions =
    "Example Fest took place at Vale Antigo in 2026. Example Fest 2027 is from July 1 to July 3.";
  const f = fixture(`${editions}\n\n${quote}`, { quote: editions });
  const previous = f.f.edition(f.event, {
    editionKey: "2026",
    startsOn: "2026-07-01",
    endsOn: "2026-07-03",
  });
  const general = fixtureTargets(f.event.id);
  general.previousEdition = {
    editionKey: previous.editionKey,
    reason: general.reason,
    evidenceIds: general.evidenceIds,
    fields: {},
  };
  const note = "Use the venue spelling on s1.";
  const geocode = vi.fn(async () => ({
    status: "success" as const,
    direction: "forward" as const,
    candidates: [
      {
        latitude: 38.7,
        longitude: -9.1,
        label: "Vale do Tejo",
        name: "Vale do Tejo",
        countryCode: "PT",
        objectType: "venue" as const,
        placeId: null,
        locality: null,
        address: null,
        originalType: null,
        category: null,
        confidence: null,
      },
    ],
  }));
  let original: LocationOutput;
  const editor = editorReply((prompt, index) => {
    if (!index) {
      return review(prompt, { path: locationPath, decision: "return", note });
    }
    expect(prompt.returnedGroups).toMatchObject([
      {
        path: locationPath,
        proposal: { venueName: { value: "Vale do Tejo" } },
        evidenceIds: ["s1-repair-1"],
      },
    ]);
    expect(prompt.evidence).toContainEqual(
      expect.objectContaining({ id: "s1-repair-1" }),
    );
    expect(prompt.repairs[0].evidenceIds).toEqual(["s1-repair-1"]);
    return review(prompt);
  });
  const { run, requests } = f.model(
    "location",
    (body, index, prompt) => {
      if (!index) {
        return modelReply(null, {
          id: marker,
          name: "geocode",
          args: { query: "Vale de Tejo", countryCode: "PT" },
        });
      }
      if (index === 1) {
        original = fixtureLocationPlan(prompt as LocationInput);
        if (original.decision.status !== "ready") {
          throw new Error("Missing Location");
        }
        const previousSlot = original.decision.previousEdition!;
        previousSlot.fields.venueName = {
          action: "set",
          value: "Vale Antigo",
          reason: "The source names this venue.",
        };
        previousSlot.evidenceIds = ["s1-e1"];
        const slot = original.decision.currentOrNextEdition!;
        slot.fields.venueName = {
          action: "set",
          value: "Vale de Tejo",
          reason: "First interpretation",
        };
        slot.evidenceIds = ["s1-e1"];
        slot.coordinates = {
          action: "select",
          precision: "exact",
          reason: "Venue candidate",
          pointId: JSON.parse(toolResult(body, marker)).pointIds[0],
        };
        return reply(body, original);
      }
      if (index === 2) {
        expect(
          body.tools?.map(({ function: tool }) => tool.name),
        ).not.toContain("geocode");
        expect(body.messages.slice(0, 2)).toEqual(
          requests[0].messages.slice(0, 2),
        );
        expect(body.messages).toContainEqual(
          expect.objectContaining({
            tool_calls: [expect.objectContaining({ id: marker })],
          }),
        );
        expect(toolResult(body, marker)).toContain("pointIds");
        expect(prompt.groups).toMatchObject([{ path: locationPath, note }]);
        return modelReply(null, {
          id: "grep",
          name: "mastra_workspace_grep",
          args: {
            path: "s1.md",
            pattern: "venue",
            contextLines: 1,
            maxCount: 1,
            caseSensitive: false,
            includeHidden: false,
          },
        });
      }
      if (index === 3) {
        expect(toolResult(body, "grep")).toContain(quote);
        return modelReply(null, {
          id: "failed-cite",
          name: "citeSavedPassage",
          args: { sourceId: "s1", quote, context: ["Incorrect context"] },
        });
      }
      if (index === 4) {
        expect(toolResult(body, "failed-cite")).toContain(
          "context[0] has no literal match",
        );
        expect(toolResult(body, "failed-cite")).toContain("Incorrect context");
        expect(JSON.stringify(body.messages[0].content)).toContain(
          "copy the exact source text and retry",
        );
        return modelReply(null, {
          id: "cite",
          name: "citeSavedPassage",
          args: { sourceId: "s1", quote },
        });
      }
      expect(toolResult(body, "cite")).toContain("s1-repair-1");
      if (original.decision.status !== "ready") {
        throw new Error("Missing Location");
      }
      const slot = original.decision.currentOrNextEdition!;
      slot.fields.venueName = {
        action: "set",
        value: "Vale do Tejo",
        reason: "Saved spelling",
      };
      slot.evidenceIds = ["s1-repair-1"];
      return reply(body, {
        decision: { ...original.decision, previousEdition: null },
      });
    },
    { editor, general },
  );
  const storage = createWorkflowStorage({ path: ":memory:" });
  const clear = vi.spyOn(ProposalRepairs.prototype, "clear");
  try {
    const result = await run({
      geocodingClient: geocode,
      workflowStorage: storage,
    });
    expect(result.errors).toEqual([]);
    expect(result.repairs?.[0].evidence).toMatchObject([{ quote }]);
    expect(geocode).toHaveBeenCalledOnce();
    const saved = f.saved().editions;
    expect(saved).toContainEqual(
      expect.objectContaining({ editionKey: "2026", venueName: "Vale Antigo" }),
    );
    expect(saved).toContainEqual(
      expect.objectContaining({
        editionKey: "2027",
        venueName: "Vale do Tejo",
        latitude: 38.7,
        longitude: -9.1,
      }),
    );
    expect(clear).toHaveBeenCalledOnce();
    expect(
      (clear.mock.contexts[0] as ProposalRepairs).raw("location"),
    ).toBeUndefined();
    const domain = (await storage.getStore("workflows"))!;
    const snapshot = await domain.loadWorkflowSnapshot({
      workflowName: "catalog-ingestion",
      runId: result.runId!,
    });
    expect(snapshot).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain(marker);
    expect(
      JSON.stringify(
        f.client.prepare("SELECT report_json FROM ingestion_runs").get(),
      ),
    ).not.toContain(marker);
  } finally {
    await storage.close();
  }
});

it("cancels a specialist return before writing and releases the conversation", async () => {
  const f = fixture("Example Fest announces a full pass and a July programme.");
  const entered = Promise.withResolvers<void>();
  const hold = Promise.withResolvers<void>();
  let returnSignal: AbortSignal | null | undefined;
  const { deps } = f.model("tickets", async (body, index, _prompt, signal) => {
    if (!index) {
      return reply(body, tickets(set({ variants: [], basePrice: null })));
    }
    returnSignal = signal;
    entered.resolve();
    await hold.promise;
    return reply(body, tickets(price(100, "EUR")));
  });
  const workflow = createFixtureIngestionWorkflow(async () => ({ deps }));
  const clear = vi.spyOn(ProposalRepairs.prototype, "clear");
  const before = f.saved();
  const run = await workflow.createRun();
  const pending = run.start({
    inputData: {
      mode: "refresh",
      input: { eventId: f.event.id, scope: "full" },
      dryRun: false,
      republish: false,
    },
  });
  await entered.promise;
  const cancel = run.cancel();
  try {
    await vi.waitFor(() => expect(returnSignal?.aborted).toBe(true));
  } finally {
    hold.resolve();
    await cancel;
    await pending;
  }
  const saved = f.client
    .prepare("SELECT report_json FROM ingestion_runs")
    .get() as { report_json: string };
  expect(JSON.parse(saved.report_json)).toMatchObject({
    operations: [],
    changes: [],
    repairs: [{ path: ticketsPath, failure: { message: "Repair cancelled" } }],
  });
  expect(f.saved()).toEqual(before);
  expect(clear).toHaveBeenCalledOnce();
  expect(
    (clear.mock.contexts[0] as ProposalRepairs).raw("tickets"),
  ).toBeUndefined();
});

it.each(["reject target", "revise date"] as const)(
  "preserves an independent change when Editor decides to %s",
  async (kind) => {
    const f = fixture(
      "Example Fest announces a corrected programme date and a new website.",
    );
    const donor = f.f.edition(f.event, {
      editionKey: "2027-donor",
      editionYear: 2027,
      startsOn: "2027-06-20",
      endsOn: "2027-06-22",
      venueName: "Donor venue",
      latitude: 38.7,
      longitude: -9.1,
      coordinatePrecision: "exact",
    });
    const term = f.f.existingTerm("event_type", "festival");
    f.f.assignTerm(donor, term);
    const question = (index: number) => ({
      field: datesPath,
      message: index
        ? "The source gives no time for the final day."
        : "Check the confirmed dates.",
    });
    const link = "https://example.org/new-site";
    const editor = editorReply((prompt, index) => {
      expect(prompt.prepared.unresolved).toContainEqual(question(index));
      if (index) {
        expect(prompt.prepared.unresolved).not.toContainEqual(question(0));
        return review(prompt);
      }
      expect(
        prompt.prepared.location.reusedFrom.currentOrNextEdition,
      ).toMatchObject({ editionKey: donor.editionKey });
      const revise: ReviewDecision = {
        path: datesPath,
        decision: "return",
        note: "Verify the dates.",
      };
      if (kind === "reject target") {
        return review(prompt, revise, {
          path: "currentOrNextEdition.target",
          decision: "reject",
          note: "Wrong Edition.",
        });
      }
      return review(prompt, revise);
    });
    const { run, requests } = f.model(
      "general",
      (body, index) => {
        const answer = fixtureTargets(f.event.id);
        answer.unresolved = [question(index)];
        if (index) {
          answer.currentOrNextEdition!.fields.dates = set({
            startsOn: "2027-06-01",
            endsOn: "2027-06-03",
            state: "confirmed",
          });
        }
        return reply(body, { result: answer });
      },
      {
        editor,
        classification: {
          previousEdition: null,
          currentOrNextEdition: {
            classification: {
              ...set({ eventType: term.slug }),
              reuseFrom: {
                editionKey: donor.editionKey,
                reason: "Programme continuity",
              },
            },
          },
          checks: fixtureChecks(["description", "currentClassification"]),
          unresolved: [],
        },
        links: {
          event: { website: set(link), socials: {} },
          currentOrNextEdition: {},
          checks: fixtureChecks(["eventLinks", "currentLinks"]),
          omitted: [],
          unresolved: [],
        },
      },
    );
    const result = await run({
      generateLocation: async (raw) => {
        const input = JSON.parse(raw) as LocationInput;
        const reply = fixtureLocationPlan(input);
        if (reply.decision.status !== "ready") {
          throw new Error("Missing Location");
        }
        const slot = reply.decision.currentOrNextEdition!;
        slot.fields.venueName = {
          action: "set",
          value: "Donor venue",
          reason: "Continuity",
        };
        slot.evidenceIds = ["s1-e1"];
        slot.coordinates = { action: "reusePrevious", reason: "Continuity" };
        return reply;
      },
    });
    expect(result.errors).toEqual([]);
    const saved = f.saved();
    expect(saved.links).toContainEqual(expect.objectContaining({ url: link }));
    const current = saved.editions.find(
      ({ editionKey }) => editionKey === "2027",
    );
    if (kind === "reject target") {
      expect(current).toBeUndefined();
      expect(result.repairs).toBeUndefined();
      expect(requests).toHaveLength(1);
    } else {
      expect(result.unresolved).toContainEqual({
        message: `currentDates: ${question(1).message}`,
      });
      expect(current).toMatchObject({
        startsOn: "2027-06-01",
        terms: [],
        venueName: null,
        latitude: null,
        longitude: null,
      });
    }
  },
);
