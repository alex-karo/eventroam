import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { Mastra } from "@mastra/core";
import { noopObserve } from "@mastra/core/tools";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  approveFixtureReview,
  fixtureChecks,
  fixtureDependencies,
  fixtureLocationPlan,
  fixtureTargets,
  runFixtureResearch,
  set,
} from "@/test/ingestion";
import {
  fixtureRoleForProvider,
  modelWireFixture,
  providerPrompt,
  providerRole,
} from "@/test/ingestion-provider";
import { readResearchCatalog } from "@/catalog/read/research";
import { DEFAULT_RESEARCH_LIMITS } from "./runtime/budget";
import { createWorkflowStorage } from "./runtime/workflow-storage";
import { createCatalogIngestionWorkflow } from "./workflow";
import { ProposalRepairs } from "./repairs";
import type { Role } from "./roles/invoke";
import type { LocationInput } from "./location/input";
import type { LocationOutput } from "./location/contracts";
import type { CollectionOutput } from "./roles/contracts";
import type { ResearchDependencies } from "./contracts";
import type { ReviewDecision, ReviewPath } from "./review";

const ticketsPath = "currentOrNextEdition.fields.tickets";
const ticketLinkPath = "currentOrNextEdition.fields.links.tickets";
const websitePath = "event.fields.links.website";
const locationPath = "currentOrNextEdition.fields.location";
const sourceUrl = "https://example.org/";
const marker = "PRIVATE_ORIGINAL_ROLE_INSTRUCTIONS_MARKER";

type Request = {
  messages: {
    role: string;
    content: unknown;
    tool_call_id?: string;
    tool_calls?: { id: string; function: { name: string } }[];
  }[];
  tools?: { function: { name: string } }[];
  response_format: { json_schema: { schema: Record<string, unknown> } };
};

function response(body: Request, answer: unknown, malformedWire = false) {
  return complete(
    JSON.stringify(
      malformedWire
        ? answer
        : modelWireFixture(answer, body.response_format.json_schema.schema),
    ),
  );
}

function complete(
  content: string | null,
  call?: { id: string; name: string; args: unknown },
) {
  return Response.json({
    id: "repair-fixture",
    object: "chat.completion",
    created: 1,
    model: "fixture/repair",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          ...(call && {
            tool_calls: [
              {
                id: call.id,
                type: "function",
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args),
                },
              },
            ],
          }),
        },
        finish_reason: call ? "tool_calls" : "stop",
      },
    ],
  });
}

type Provider = (
  body: Request,
  index: number,
  prompt: ReturnType<typeof providerPrompt>,
  signal?: AbortSignal | null,
) => Response | Promise<Response>;
function controlled(roles: Partial<Record<Role, Provider>>) {
  const requests: Partial<Record<Role, Request[]>> = {};
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const role = providerRole(body) as Role;
    const list = (requests[role] ??= []);
    list.push(body);
    const handle = roles[role];
    return handle
      ? handle(body, list.length - 1, providerPrompt(body), init?.signal)
      : complete(JSON.stringify(await fixtureRoleForProvider(body)));
  });
  return requests;
}

function decisions(
  prompt: { reviewPaths: ReviewPath[] },
  overrides: ReviewDecision[] = [],
) {
  const review = new Map(
    approveFixtureReview(prompt.reviewPaths).decisions.map((entry) => [
      entry.path,
      entry,
    ]),
  );
  for (const entry of overrides) {
    review.set(entry.path, entry);
  }
  return { decisions: [...review.values()] };
}

function ticketAnswer(block?: unknown, unresolved: unknown[] = []) {
  return {
    currentOrNextEdition: block ? { tickets: block } : {},
    checks: fixtureChecks(["currentTickets"]),
    unresolved,
  };
}

function price(amount: number, currency: "DKK" | "EUR", ids = ["s1-e1"]) {
  return set(
    {
      variants: [{ label: "Full pass", amount, currency }],
      basePrice: {
        kind: "exact",
        currency,
        minAmount: amount,
        maxAmount: amount,
        coverage: "full_programme",
      },
    },
    "The official page gives the full programme price.",
    ids,
  );
}

async function capturedPage(festival: "roskilde" | "wacken") {
  return readFile(
    new URL(`./evals/cases/${festival}/tickets.md`, import.meta.url),
    "utf8",
  );
}

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(page: string, name = "Example Fest") {
  const root = await mkdtemp(join(tmpdir(), "eventroam-repair-"));
  directories.push(root);
  vi.stubEnv("CATALOG_SOURCE_DIRECTORY", root);
  vi.stubEnv("CATALOG_TRACING", "false");
  const { client } = testDatabase();
  const f = testFixtures(client);
  const event = f.event({ canonicalName: name });
  f.link({ event }, { kind: "official_site", official: true, url: sourceUrl });
  const defaults = fixtureDependencies({
    reader: async (_role: unknown, raw: string) => {
      const quote = JSON.parse(raw)
        .page.split("\n")
        .find(
          (line: string) =>
            line.trim() && JSON.parse(raw).page.split(line).length === 2,
        );
      return {
        overview: name,
        coverage: { found: [], notPublished: [] },
        topics: [
          "identity",
          "location",
          "links",
          "dates",
          "tickets",
          "classification",
          "description",
        ],
        statedYears: [],
        limitations: [],
        evidence: [
          {
            quote,
            topics: [
              "identity",
              "location",
              "links",
              "dates",
              "tickets",
              "classification",
              "description",
            ],
          },
        ],
      };
    },
  });
  const deps = {
    client,
    config: {
      apiKey: "fixture",
      model: "fixture/repair",
      limits: DEFAULT_RESEARCH_LIMITS,
    },
    todayUtc: "2026-11-01",
    observabilityStore: null,
    generateLocation: defaults.generateLocation,
    readPage: (async (url, { budget }) => {
      budget.consumePage();
      return {
        attemptedUrl: url,
        finalUrl: url,
        retrievedAt: "2026-11-01T00:00:00Z",
        status: "ok",
        method: "http",
        markdown: page,
      };
    }) satisfies NonNullable<ResearchDependencies["readPage"]>,
  };
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "test",
    dryRun: false,
  };
  const run = async (
    native: Role[],
    overrides: Partial<ResearchDependencies> = {},
    scope?: "current" | "full",
  ) =>
    runFixtureResearch(
      { ...input, scope },
      {
        ...deps,
        generateRoles: Object.fromEntries(
          (
            [
              "reader",
              "research",
              "general",
              "tickets",
              "classification",
              "links",
              "editor",
            ] as const
          )
            .filter((role) => !native.includes(role))
            .map((role) => [role, defaults.generateRole]),
        ),
        ...overrides,
      },
    );
  return { client, f, event, input, run, deps, defaults };
}

it.each(["price", "invalid", "omission", "unknown", "target"] as const)(
  "routes the Wacken empty offers before review: %s",
  async (kind) => {
    const page =
      kind === "omission"
        ? "Wacken Open Air announced the next festival. No applicable price is published."
        : await capturedPage("wacken");
    const f = await fixture(page, "Wacken Open Air");
    f.f.edition(f.event, {
      editionKey: "2027",
      editionYear: 2027,
      priceDetails: [{ label: "Saved pass", amount: 350, currency: "EUR" }],
    });
    const quote = "Preis: 364 € zzgl. 2 € Ticketgebühr";
    const requests = controlled({
      tickets: (body, index, prompt) => {
        const invalid = ticketAnswer(
          set({ variants: [], basePrice: null }, "Empty offer list", [
            kind === "unknown" ? "unknown-id" : "s1-e1",
          ]),
        );
        if (index === 0 || kind === "invalid") {
          return response(body, invalid);
        }
        expect(prompt.groups[0]).toMatchObject({
          path: ticketsPath,
          note: expect.stringContaining("empty offer list"),
          original: { value: { variants: [] } },
        });
        expect(JSON.stringify(body.messages.slice(0, -1))).toContain(
          "Empty offer list",
        );
        if (kind === "omission") {
          return response(
            body,
            ticketAnswer(undefined, [
              {
                field: ticketsPath,
                message: "The saved page has no applicable price.",
              },
            ]),
          );
        }
        if (index === 1) {
          return complete(null, {
            id: "cite-wacken",
            name: "citeSavedPassage",
            args: { sourceId: "s1", quote, context: ["## LOUDER-TICKET"] },
          });
        }
        expect(
          body.messages.find(
            ({ tool_call_id }) => tool_call_id === "cite-wacken",
          )?.content,
        ).toContain("s1-repair-1");
        return response(body, ticketAnswer(price(364, "EUR", ["s1-repair-1"])));
      },
      general: async (body) => {
        const answer = fixtureTargets(f.event.id);
        if (kind === "target") {
          (
            answer.currentOrNextEdition as unknown as { editionKey: number }
          ).editionKey = 7;
        }
        return response(body, { result: answer });
      },
      editor: (body, _index, prompt) => {
        expect(
          prompt.reviewPaths.find(
            ({ path }: ReviewPath) => path === ticketsPath,
          ),
        ).toEqual({
          path: ticketsPath,
          required: true,
          allowed: ["approve", "reject"],
        });
        if (kind === "omission") {
          expect(prompt.repairs[0].omissionReason).toContain(
            "no applicable price",
          );
        }
        return response(body, decisions(prompt));
      },
    });
    const result = await f.run(["tickets", "general", "editor"]);
    if (["invalid", "unknown", "target"].includes(kind)) {
      expect(result.operations).toEqual([]);
      expect(result.editorStatus).toBe("not_run");
      expect(result.repairs?.length ?? 0).toBe(kind === "invalid" ? 1 : 0);
      if (kind === "unknown") {
        expect(result.errors[0].message).toContain("unknown evidence");
      }
      if (kind === "target") {
        expect(requests.tickets).toBeUndefined();
      } else {
        expect(requests.tickets).toHaveLength(kind === "invalid" ? 2 : 1);
      }
      return;
    }
    expect(result.errors).toEqual([]);
    expect(result.repairs?.[0]).toMatchObject({
      path: ticketsPath,
      trigger: "validation",
      target: { eventId: f.event.id, editionKey: "2027" },
      decision: { decision: "approve" },
      original: { value: { variants: [] } },
    });
    const saved = readResearchCatalog(f.client)[0].editions[0];
    if (kind === "price") {
      expect(saved.priceDetails[0]).toMatchObject({
        amount: 364,
        currency: "EUR",
      });
      expect(result.repairs?.[0].evidence).toMatchObject([{ quote }]);
    } else {
      expect(saved.priceDetails[0]).toMatchObject({
        amount: 350,
        currency: "EUR",
      });
      expect(result.unresolved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: ticketsPath,
            message: expect.stringContaining("no applicable price"),
          }),
          {
            message: "currentTickets: The saved page has no applicable price.",
          },
        ]),
      );
    }
  },
);

it.each(["revised", "open question", "omitted", "unrelated question"] as const)(
  "returns Roskilde tickets with the exact note and keeps the earlier link: %s",
  async (kind) => {
    const f = await fixture(
      await capturedPage("roskilde"),
      "Roskilde Festival",
    );
    const note =
      "  Check s1, Smart Ticket: 524 kr. om måneden plus 100,- i gebyr. Keep the supported full pass.\n";
    const link = "https://www.roskilde-festival.dk/da/billetter";
    const requests = controlled({
      tickets: (body, index, prompt) => {
        const fullPass = price(2650, "DKK");
        if (!index) {
          fullPass.value.variants.push({
            label: "Smart Ticket instalment",
            amount: 524,
            currency: "DKK",
          });
          return response(body, ticketAnswer(fullPass));
        }
        expect(prompt.groups).toEqual([
          expect.objectContaining({ path: ticketsPath, note }),
        ]);
        expect(JSON.stringify(body.messages)).toContain(
          "Smart Ticket instalment",
        );
        const field = kind === "omitted" ? ticketsPath : "tickets";
        return response(
          body,
          ticketAnswer(
            kind === "revised" || kind === "open question"
              ? fullPass
              : undefined,
            kind === "revised"
              ? []
              : [
                  {
                    field: kind === "open question" ? ticketsPath : field,
                    message: "The price qualification remains open.",
                  },
                ],
          ),
        );
      },
      links: (body) =>
        response(body, {
          event: { socials: {} },
          currentOrNextEdition: { tickets: set(link) },
          checks: fixtureChecks(["eventLinks", "currentLinks"]),
          omitted: [],
          unresolved: [],
        }),
      editor: (body, index, prompt) => {
        if (!index) {
          return response(
            body,
            decisions(prompt, [
              { path: ticketsPath, decision: "return", note },
            ]),
          );
        }
        expect(prompt.reviewPaths).toEqual([
          { path: ticketsPath, required: true, allowed: ["approve", "reject"] },
        ]);
        expect(prompt.prepared).not.toHaveProperty("plan");
        if (kind === "omitted") {
          expect(prompt.repairs[0].omissionReason).toBe(
            "The price qualification remains open.",
          );
        }
        return response(
          body,
          decisions(
            prompt,
            kind === "omitted"
              ? [
                  {
                    path: ticketsPath,
                    decision: "reject",
                    note: "Leave the saved field.",
                  },
                ]
              : [],
          ),
        );
      },
    });
    const result = await f.run(["tickets", "links", "editor"]);
    if (kind === "unrelated question") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: ticketsPath,
          message: expect.stringContaining("exact group"),
        }),
      );
      expect(result.operations).toEqual([]);
      expect(requests.editor).toHaveLength(1);
      return;
    }
    expect(result.errors).toEqual([]);
    expect(result.repairs?.[0]).toMatchObject({
      note,
      path: ticketsPath,
      trigger: "editor",
    });
    const edition = readResearchCatalog(f.client)[0].editions[0];
    expect(edition.links).toContainEqual(
      expect.objectContaining({ url: link }),
    );
    if (kind === "open question") {
      expect(result.researchStatus).toBe("partial");
      expect(result.unresolved).toContainEqual({
        message: "currentTickets: The price qualification remains open.",
      });
    }
    if (kind === "revised" || kind === "open question") {
      expect(edition.priceDetails).toMatchObject([
        { amount: 2650, currency: "DKK" },
      ]);
    } else {
      expect(result.repairs?.[0]).toMatchObject({
        decision: { decision: "reject" },
        omissionReason: "The price qualification remains open.",
      });
    }
  },
);

it.each([
  "bad URL",
  "wrong type",
  "unknown reference",
  "bad revision",
] as const)(
  "revises a malformed website while keeping the first ticket link: %s",
  async (kind) => {
    const f = await fixture(
      "Example Fest official website and ticket overview.",
    );
    const link = "https://example.org/tickets";
    controlled({
      links: (body, index, prompt) => {
        const answer = {
          event: {
            website: set(
              index && kind !== "bad revision"
                ? "https://example.org/official"
                : "bad-url",
            ),
            socials: {},
          },
          currentOrNextEdition: { tickets: set(!index ? link : "bad-url") },
          checks: fixtureChecks(["eventLinks", "currentLinks"]),
          omitted: [],
          unresolved: [],
        };
        if (index) {
          expect(prompt.groups).toMatchObject([
            {
              path: websitePath,
              note: expect.stringContaining("event.website"),
            },
          ]);
        }
        if (index && kind === "unknown reference") {
          answer.checks[1].sourceIds = ["unknown-source"];
        }
        if (index === 1 && kind === "wrong type") {
          return complete("Inspect the saved page.", {
            id: "look-up-link",
            name: "mastra_workspace_grep",
            args: {
              path: "s1.md",
              pattern: "official",
              contextLines: 1,
              maxCount: 1,
              caseSensitive: false,
              includeHidden: false,
            },
          });
        }
        if (index && kind === "wrong type") {
          return response(
            body,
            { ...answer, currentOrNextEdition: { tickets: 12 } },
            true,
          );
        }
        return response(body, answer);
      },
    });
    const result = await f.run(["links"]);
    if (kind === "unknown reference" || kind === "bad revision") {
      expect(result.errors).not.toEqual([]);
      expect(result.operations).toEqual([]);
      expect(result.repairs?.[0].failure).toBeDefined();
      return;
    }
    expect(result.errors).toEqual([]);
    expect(result.repairs?.[0]).toMatchObject({
      path: websitePath,
      trigger: "validation",
    });
    expect(readResearchCatalog(f.client)[0].editions[0].links).toContainEqual(
      expect.objectContaining({ url: link }),
    );
  },
);

it("continues Location with native geocode history and a newly bound venue citation", async () => {
  const f = await fixture("Example Fest 2027.\n\nThe venue is Vale do Tejo.");
  const note = "Use the venue spelling on s1: Vale do Tejo.";
  const point = vi.fn(async () => ({
    status: "success" as const,
    direction: "forward" as const,
    candidates: [
      {
        latitude: 38.7,
        longitude: -9.1,
        placeId: null,
        label: "Vale do Tejo",
        name: "Vale do Tejo",
        countryCode: "PT",
        locality: null,
        address: null,
        objectType: "venue" as const,
        originalType: null,
        category: null,
        confidence: null,
      },
    ],
  }));
  let original: LocationOutput;
  const requests = controlled({
    location: (body, index, prompt) => {
      if (!index) {
        return complete(null, {
          id: marker,
          name: "geocode",
          args: { query: "Vale de Tejo", countryCode: "PT" },
        });
      }
      if (index === 1) {
        original = fixtureLocationPlan(prompt as LocationInput);
        if (original.decision.status !== "ready") {
          throw new Error("Fixture did not select a place");
        }
        Object.assign(original.decision.currentOrNextEdition!, {
          fields: {
            ...original.decision.currentOrNextEdition!.fields,
            venueName: {
              action: "set",
              value: "Vale de Tejo",
              reason: "First interpretation",
            },
          },
          evidenceIds: ["s1-e1"],
          coordinates: {
            action: "select",
            precision: "exact",
            reason: "Venue candidate",
            pointId: JSON.parse(
              String(
                body.messages.find(
                  ({ tool_call_id }) => tool_call_id === marker,
                )?.content,
              ),
            ).pointIds[0],
          },
        });
        return response(body, original);
      }
      expect(body.tools?.map(({ function: tool }) => tool.name)).not.toContain(
        "geocode",
      );
      expect(
        body.messages.find(({ role }) => role === "system")?.content,
      ).toEqual(requests.location![0].messages[0].content);
      expect(
        body.messages.find(({ role }) => role === "user")?.content,
      ).toEqual(requests.location![0].messages[1].content);
      expect(
        body.messages.some(({ tool_calls }) =>
          tool_calls?.some(({ id }) => id === marker),
        ),
      ).toBe(true);
      expect(
        body.messages.some(({ tool_call_id }) => tool_call_id === marker),
      ).toBe(true);
      expect(prompt.groups).toMatchObject([{ path: locationPath, note }]);
      if (index === 2) {
        return complete(null, {
          id: "search-location",
          name: "mastra_workspace_grep",
          args: {
            path: "s1.md",
            pattern: "venue",
            contextLines: 1,
            maxCount: 3,
            caseSensitive: false,
            includeHidden: false,
          },
        });
      }
      if (index === 3) {
        expect(
          body.messages.find(
            ({ tool_call_id }) => tool_call_id === "search-location",
          )?.content,
        ).toContain("Vale do Tejo");
        return complete(null, {
          id: "cite-location",
          name: "citeSavedPassage",
          args: { sourceId: "s1", quote: "The venue is Vale do Tejo." },
        });
      }
      expect(
        body.messages.find(
          ({ tool_call_id }) => tool_call_id === "cite-location",
        )?.content,
      ).toContain("s1-repair-1");
      const corrected = structuredClone(original);
      if (corrected.decision.status !== "ready") {
        throw new Error("Missing Location");
      }
      corrected.decision.currentOrNextEdition!.fields.venueName = {
        action: "set",
        value: "Vale do Tejo",
        reason: "Saved source spelling",
      };
      corrected.decision.currentOrNextEdition!.evidenceIds = ["s1-repair-1"];
      return response(body, corrected);
    },
    editor: (body, index, prompt) => {
      if (!index) {
        return response(
          body,
          decisions(prompt, [{ path: locationPath, decision: "return", note }]),
        );
      }
      expect(prompt.returnedGroups).toMatchObject([
        {
          path: locationPath,
          proposal: { venueName: { value: "Vale do Tejo" } },
        },
      ]);
      expect(prompt.prepared.basis.evidence).toContainEqual(
        expect.objectContaining({ id: "s1-repair-1" }),
      );
      return response(body, decisions(prompt));
    },
  });
  const storage = createWorkflowStorage({ path: ":memory:" });
  const clear = vi.spyOn(ProposalRepairs.prototype, "clear");
  const result = await (async () => {
    try {
      const report = await f.run(["location", "editor"], {
        generateLocation: undefined,
        geocodingClient: point,
        workflowStorage: storage,
      });
      const domain = (await storage.getStore("workflows"))!;
      const { runs } = await domain.listWorkflowRuns({
        workflowName: "catalog-ingestion",
      });
      expect(runs).toHaveLength(1);
      expect(JSON.stringify(runs[0])).not.toContain(marker);
      expect(clear).toHaveBeenCalledTimes(1);
      expect(
        (clear.mock.contexts[0] as ProposalRepairs).raw("location"),
      ).toBeUndefined();
      return report;
    } finally {
      clear.mockRestore();
      await storage.close();
    }
  })();
  expect(result.errors).toEqual([]);
  expect(point).toHaveBeenCalledTimes(1);
  expect(result.repairs?.[0].evidence).toMatchObject([
    { quote: "The venue is Vale do Tejo." },
  ]);
  expect(
    JSON.stringify(
      f.client.prepare("SELECT report_json FROM ingestion_runs").get(),
    ),
  ).not.toContain(marker);
  expect(readResearchCatalog(f.client)[0].editions[0]).toMatchObject({
    venueName: "Vale do Tejo",
    latitude: 38.7,
    longitude: -9.1,
  });
});

it("cancels a specialist return before writing and releases its conversation", async () => {
  const f = await fixture(
    "Example Fest announces a full pass and a July programme.",
  );
  const entered = Promise.withResolvers<void>();
  const hold = Promise.withResolvers<void>();
  let returnSignal: AbortSignal | null | undefined;
  controlled({
    tickets: async (body, index, _prompt, signal) => {
      if (!index) {
        return response(
          body,
          ticketAnswer(set({ variants: [], basePrice: null })),
        );
      }
      returnSignal = signal;
      entered.resolve();
      await hold.promise;
      return response(body, ticketAnswer(price(100, "EUR")));
    },
  });
  const storage = createWorkflowStorage({ path: ":memory:" });
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: {
      ...f.deps,
      workflowStorage: storage,
      generateRoles: Object.fromEntries(
        (
          [
            "reader",
            "research",
            "general",
            "classification",
            "links",
            "editor",
          ] as const
        ).map((role) => [role, f.defaults.generateRole]),
      ),
    },
  }));
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  const clear = vi.spyOn(ProposalRepairs.prototype, "clear");
  try {
    const before = readResearchCatalog(f.client);
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
      repairs: [
        { path: ticketsPath, failure: { message: "Repair cancelled" } },
      ],
    });
    expect(readResearchCatalog(f.client)).toEqual(before);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(
      (clear.mock.contexts[0] as ProposalRepairs).raw("tickets"),
    ).toBeUndefined();
  } finally {
    hold.resolve();
    clear.mockRestore();
    await host.shutdown();
  }
});

it.each(["size", "dates"] as const)(
  "returns General's invalid %s only when the fixed target can be confirmed",
  async (field) => {
    const f = await fixture(
      "Example Fest July 2027. The festival expects 2000 participants.",
    );
    const requests = controlled({
      general: (body, index, prompt) => {
        const answer = fixtureTargets(f.event.id);
        const fields = answer.currentOrNextEdition!.fields;
        fields.sizeEstimate = set(index ? 2000 : -1);
        if (field === "dates") {
          fields.dates = set({
            startsOn: "bad-date",
            endsOn: "2027-07-03",
            state: "confirmed",
          });
        }
        if (index) {
          expect(prompt.groups).toMatchObject([
            { path: "currentOrNextEdition.fields.sizeEstimate" },
          ]);
        }
        return response(body, { result: answer });
      },
    });
    const result = await f.run(["general"]);
    if (field === "dates") {
      expect(requests.general).toHaveLength(1);
      expect(result.editorStatus).toBe("not_run");
      expect(result.operations).toEqual([]);
    } else {
      expect(requests.general).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(readResearchCatalog(f.client)[0].editions[0].sizeEstimate).toBe(
        2000,
      );
    }
  },
);

it.each(["revised", "omit", "excess"] as const)(
  "batches both Classification conflicts in one pre-review request: %s",
  async (kind) => {
    const f = await fixture(
      "Example Fest has a completed 2026 festival and announces the 2027 festival.",
    );
    const old = f.f.edition(f.event, {
      editionKey: "2026",
      editionYear: 2026,
      startsOn: "2026-07-01",
      endsOn: "2026-07-03",
    });
    const festival = f.f.existingTerm("event_type", "festival");
    const gathering = f.f.existingTerm("event_type", "gathering");
    f.f.assignTerm(old, festival);
    const general = fixtureTargets(f.event.id);
    general.previousEdition = {
      editionKey: "2026",
      reason: "Completed festival",
      evidenceIds: ["s1-e1"],
      fields: {},
    };
    const requests = controlled({
      general: (body) => response(body, { result: general }),
      classification: (body, index, prompt) => {
        const previousPath = "previousEdition.fields.classification";
        const classification = set(
          index && kind !== "excess"
            ? [festival.id]
            : [festival.id, gathering.id],
        );
        if (index) {
          expect(prompt.groups).toEqual(
            ["previousEdition", "currentOrNextEdition"].map((slot) =>
              expect.objectContaining({
                path: `${slot}.fields.classification`,
                note: expect.stringContaining(
                  `event_type term allowed (limit: 1); received: ${festival.id}, ${gathering.id}`,
                ),
              }),
            ),
          );
        }
        return response(body, {
          previousEdition: index && kind === "omit" ? {} : { classification },
          currentOrNextEdition: { classification },
          checks: fixtureChecks([
            "previousClassification",
            "currentClassification",
            "description",
          ]),
          unresolved:
            index && kind === "omit"
              ? [
                  {
                    field: previousPath,
                    message: "The previous type remains uncertain.",
                  },
                ]
              : [],
        });
      },
    });
    const result = await f.run(["general", "classification"]);
    expect(requests.classification).toHaveLength(2);
    expect(result.repairs).toHaveLength(2);
    if (kind === "excess") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "invalid_plan",
          stage: "validation",
          field: "previousEdition.fields.classification",
          message: expect.stringContaining(
            `event_type term allowed (limit: 1); received: ${festival.id}, ${gathering.id}`,
          ),
        }),
      );
      expect(result.operations).toEqual([]);
      return;
    }
    expect(result.errors).toEqual([]);
    expect(
      readResearchCatalog(f.client)[0].editions.map((edition) =>
        edition.terms.map(({ id }) => id),
      ),
    ).toEqual([[festival.id], [festival.id]]);
    if (kind === "omit") {
      expect(result.repairs?.[0].omissionReason).toBe(
        "The previous type remains uncertain.",
      );
    }
  },
);

it("batches a website and an omitted ticket link, with separate notes and coverage", async () => {
  const f = await fixture(
    "Example Fest official site. Ticket overview at https://example.org/tickets.",
  );
  const generate = f.defaults.generateRole;
  f.defaults.generateRole = async (role, prompt, call) => {
    const output = await generate(role, prompt, call);
    if (role === "research") {
      const check = (output as CollectionOutput).checks.find(
        ({ check }) => check === "currentLocation",
      )!;
      check.blocker = "Travel page unavailable.";
    }
    return output;
  };
  const notes = [
    "Look at the official site excerpt.",
    "s1 names the ticket overview.",
  ];
  const requests = controlled({
    links: (body, index, prompt) => {
      if (index) {
        expect(prompt.groups).toEqual([
          expect.objectContaining({ path: websitePath, note: notes[0] }),
          expect.objectContaining({
            path: ticketLinkPath,
            note: notes[1],
            original: null,
          }),
        ]);
      }
      return response(body, {
        event: {
          website: set(index ? "https://example.org/new" : sourceUrl),
          socials: {},
        },
        currentOrNextEdition: index
          ? { tickets: set("https://example.org/tickets") }
          : {},
        omitted: [],
        checks: fixtureChecks(["eventLinks", "currentLinks"]),
        unresolved: [
          { field: "instagram", message: "Verify the official social link." },
        ],
      });
    },
    editor: (body, index, prompt) => {
      if (index) {
        expect(prompt.reviewPaths.map(({ path }: ReviewPath) => path)).toEqual([
          websitePath,
          ticketLinkPath,
        ]);
        return response(
          body,
          decisions(prompt, [
            {
              path: websitePath,
              decision: "reject",
              note: "Keep the original.",
            },
          ]),
        );
      }
      return response(
        body,
        decisions(
          prompt,
          [websitePath, ticketLinkPath].map((path, i) => ({
            path,
            decision: "return" as const,
            note: notes[i],
          })),
        ),
      );
    },
  });
  const result = await f.run(["links", "editor"]);
  expect(requests.links).toHaveLength(2);
  expect(result.errors).toEqual([]);
  expect(result.researchStatus).toBe("partial");
  expect(result.unresolved).toEqual(
    expect.arrayContaining([
      { field: "instagram", message: "Verify the official social link." },
      { message: "eventLinks: Verify the official social link." },
      { message: "currentLocation: Travel page unavailable." },
    ]),
  );
  const [event] = readResearchCatalog(f.client);
  expect(event.links).toContainEqual(
    expect.objectContaining({ url: sourceUrl }),
  );
  expect(event.editions[0].links).toContainEqual(
    expect.objectContaining({ url: "https://example.org/tickets" }),
  );
});

it("cannot return omitted Event groups in current refresh", async () => {
  const f = await fixture(
    "Example Fest official site and July 2027 programme.",
  );
  const requests = controlled({
    editor: (body, _index, prompt) => {
      for (const field of [
        websitePath,
        "event.fields.description",
        "event.fields.shortDescription",
      ]) {
        expect(
          prompt.reviewPaths.map(({ path }: ReviewPath) => path),
        ).not.toContain(field);
      }
      return response(
        body,
        decisions(prompt, [
          { path: websitePath, decision: "return", note: "Find a new site." },
        ]),
      );
    },
  });
  const result = await f.run(["editor"], {}, "current");
  expect(requests.editor).toHaveLength(1);
  expect(result.editorStatus).toBe("failed");
  expect(result.repairs).toBeUndefined();
  expect(result.operations).toEqual([]);
});

it.each(["original", "revision"] as const)(
  "rejects an out-of-assignment Event field before using a Links %s",
  async (phase) => {
    const f = await fixture("Example Fest lists an official ticket overview.");
    const requests = controlled({
      links: (body, index) =>
        response(body, {
          event: {
            socials: {},
            ...((index || phase === "original") && { website: set(sourceUrl) }),
          },
          currentOrNextEdition: {
            tickets: set(
              phase === "original" ? "bad-url" : "https://example.org/tickets",
            ),
          },
          checks: fixtureChecks(["currentLinks"]),
          omitted: [],
          unresolved: [],
        }),
      editor: (body, _index, prompt) =>
        response(
          body,
          decisions(prompt, [
            {
              path: ticketLinkPath,
              decision: "return",
              note: "Check the ticket overview.",
            },
          ]),
        ),
    });
    const result = await f.run(["links", "editor"], {}, "current");
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: "links: Event fields are outside the assignment",
      }),
    );
    expect(result.operations).toEqual([]);
    expect(requests.links).toHaveLength(phase === "original" ? 1 : 2);
    expect(requests.editor ?? []).toHaveLength(phase === "original" ? 0 : 1);
  },
);

it.each(["revise description", "reject target", "revise date"] as const)(
  "preserves independent decisions and drops obsolete temporal premises: %s",
  async (kind) => {
    const f = await fixture(
      "Example Fest has different descriptions and a corrected July date.",
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
    const shortPath = "event.fields.shortDescription";
    const datesPath = "currentOrNextEdition.fields.dates";
    const link = "https://example.org/new-site";
    const requests = controlled({
      general: (body, index) => {
        const answer = fixtureTargets(f.event.id);
        if (index) {
          answer.currentOrNextEdition!.fields.dates = set({
            startsOn: "2027-06-01",
            endsOn: "2027-06-03",
            state: "confirmed",
          });
        }
        return response(body, { result: answer });
      },
      classification: (body, index) =>
        response(body, {
          description: set(
            index ? "Unrequested rewrite." : "The approved detailed text.",
          ),
          shortDescription: set(
            index ? "Correct short text." : "Short text to revisit.",
          ),
          previousEdition: null,
          currentOrNextEdition: {
            classification: {
              ...set([term.id]),
              reuseFrom: {
                editionKey: donor.editionKey,
                reason: "The official programme confirms continuity.",
              },
            },
          },
          checks: fixtureChecks(["description", "currentClassification"]),
          unresolved: [],
        }),
      links: (body) =>
        response(body, {
          event: { website: set(link), socials: {} },
          currentOrNextEdition: {},
          omitted: [],
          checks: fixtureChecks(["eventLinks", "currentLinks"]),
          unresolved: [],
        }),
      editor: (body, index, prompt) => {
        if (index) {
          return response(body, decisions(prompt));
        }
        if (kind === "revise date") {
          expect(
            prompt.prepared.location.reusedFrom.currentOrNextEdition,
          ).toMatchObject({ editionKey: donor.editionKey });
        }
        const entry: ReviewDecision = {
          path: kind === "revise description" ? shortPath : datesPath,
          decision: "return",
          note: "Verify this group from the saved page.",
        };
        const overrides: ReviewDecision[] = [entry];
        if (kind === "reject target") {
          overrides.push({
            path: "currentOrNextEdition.target",
            decision: "reject",
            note: "Wrong Edition.",
          });
        }
        return response(body, decisions(prompt, overrides));
      },
    });
    const result = await f.run(
      ["general", "classification", "links", "editor"],
      kind === "revise date"
        ? {
            generateLocation: async (prompt) => {
              const input = JSON.parse(prompt) as LocationInput;
              const reply = fixtureLocationPlan(input);
              if (reply.decision.status !== "ready") {
                throw new Error("Fixture did not select a place");
              }
              expect(
                input.currentOrNextEdition?.previousPoint?.editionKey,
              ).toBe(donor.editionKey);
              Object.assign(reply.decision.currentOrNextEdition!, {
                fields: {
                  ...reply.decision.currentOrNextEdition!.fields,
                  venueName: {
                    action: "set",
                    value: "Donor venue",
                    reason: "Continuity",
                  },
                },
                evidenceIds: ["s1-e1"],
                coordinates: { action: "reusePrevious", reason: "Continuity" },
              });
              return reply;
            },
          }
        : {},
    );
    expect(result.errors).toEqual([]);
    const [event] = readResearchCatalog(f.client);
    expect(event.links).toContainEqual(expect.objectContaining({ url: link }));
    expect(event.description).toBe("The approved detailed text.");
    if (kind === "revise description") {
      expect(event.shortDescription).toBe("Correct short text.");
      expect(requests.classification).toHaveLength(2);
    }
    const current = event.editions.find(
      ({ editionKey }) => editionKey === "2027",
    );
    if (kind === "reject target") {
      expect(current).toBeUndefined();
      expect(result.repairs).toBeUndefined();
      expect(requests.general).toHaveLength(1);
    } else if (kind === "revise date") {
      expect(current).toMatchObject({
        startsOn: "2027-06-01",
        terms: [],
        venueName: null,
        latitude: null,
        longitude: null,
      });
      expect(result.operations).not.toContainEqual(
        expect.objectContaining({ kind: "replaceTerms" }),
      );
    }
  },
);

it("binds new citations without modifying the frozen Reader corpus", async () => {
  const { createCorpusStorage } = await import("./evidence/storage");
  const { savedCitation } = await import("./evidence/repair");
  const { writeFile } = await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "eventroam-repair-cite-"));
  directories.push(root);
  const storage = createCorpusStorage("citation-test", 0, root);
  const page =
    "Two repeated rows.\nTwo repeated rows.\n\n[Official overview](https://example.org/tickets)";
  const source = await storage.savePage({
    attemptedUrl: sourceUrl,
    finalUrl: sourceUrl,
    markdown: page,
    method: "http",
    status: "ok",
    retrievedAt: "2026-11-01T00:00:00Z",
  });
  const corpus = storage.freeze();
  const passages: import("./evidence/contracts").Evidence[] = [];
  const cite = savedCitation(corpus, passages, new AbortController().signal);
  const context = { observe: noopObserve };
  expect(
    await cite.execute!(
      { sourceId: source.id, quote: "Two repeated rows." },
      context,
    ),
  ).toMatchObject({
    error: expect.stringContaining("no unique literal match"),
  });
  expect(
    await cite.execute!(
      {
        sourceId: source.id,
        quote: "[Official overview](https://example.org/tickets)",
      },
      context,
    ),
  ).toMatchObject({
    evidenceId: "s1-repair-1",
    anchors: [
      { label: "Official overview", url: "https://example.org/tickets" },
    ],
  });
  expect(corpus.evidence).toEqual([]);
  expect(passages).toHaveLength(1);
  await writeFile(
    source.markdownPath!,
    (await readFile(source.markdownPath!, "utf8")) + " Changed",
  );
  expect(
    await cite.execute!(
      { sourceId: source.id, quote: "Official overview" },
      context,
    ),
  ).toMatchObject({
    error: "Saved source is unavailable or has changed",
  });
  expect(passages).toHaveLength(1);
});
