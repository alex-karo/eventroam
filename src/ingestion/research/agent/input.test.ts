import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../../runtime/budget";
import type { ReadPageResult } from "../../tools/read-page/contracts";
import {
  modelContext,
  promptFor,
} from "@/test/ingestion-fixtures/research-input";
import { createSourceSession } from "../../tools/session";
import { createResearchTools } from "../../tools";
import { vi } from "vitest";
import type { CatalogResearchInput } from "../../contracts";
import { loadResearchContext } from "../context";

const source: ReadPageResult = {
  attemptedUrl: "https://example.org/announcement",
  finalUrl: "https://example.org/2027",
  retrievedAt: "2026-10-08T12:00:00Z",
  method: "http",
  status: "ok",
  reasonCode: "javascript_required",
  markdown: "Example Fest 2027.\n\nTicket information follows.",
  httpStatus: 200,
};

test("saved prices in model context use major units and omit aggregate availability", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ id: "input-fest", canonicalName: "Example Fest" });
  fx.edition(event, {
    id: "input-edition",
    editionKey: "2027",
    priceKind: "exact",
    priceCurrency: "KWD",
    priceMinMinor: 1234,
    priceMaxMinor: 1234,
    priceCoverage: "full_programme",
    priceDetails: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
  });
  const catalog = readResearchCatalog(client);
  const context = modelContext(catalog[0]);
  expect(context.editions[0].tickets).toEqual({
    variants: [
      {
        label: "Regular",
        amount: 1.234,
        currency: "KWD",
        availability: "available",
      },
    ],
    basePrice: {
      kind: "exact",
      currency: "KWD",
      minAmount: 1.234,
      maxAmount: 1.234,
      coverage: "full_programme",
    },
  });
  expect(context.editions[0]).not.toHaveProperty("priceMinMinor");
  expect(context.editions[0]).not.toHaveProperty("ticketAvailability");
  expect(context).not.toHaveProperty("version");
  expect(context).not.toHaveProperty("createdAt");
  expect(context).not.toHaveProperty("updatedAt");
  expect(context.editions[0]).not.toHaveProperty("id");
  expect(context.editions[0]).not.toHaveProperty("eventId");
  expect(context.editions[0]).not.toHaveProperty("version");
  expect(context.editions[0]).not.toHaveProperty("createdAt");
  expect(JSON.stringify(context).length).toBeLessThan(
    JSON.stringify(catalog[0]).length,
  );
  const prompt = promptFor(
    { mode: "refresh", eventId: event.id, actor: "tester" },
    catalog,
    [
      {
        url: source.finalUrl,
        owner: "event",
        kind: "official_site",
        official: true,
      },
    ],
    [{ id: "music", facet: "topic", slug: "music" }],
    createResearchBudget({}, () => 0).remaining(),
    [source],
    "2026-10-08T12:00:00.000Z",
  );
  expect(JSON.parse(prompt).compact).not.toBeNull();
  expect(JSON.parse(prompt).remaining).toEqual({
    searches: 3,
    durationMs: 600_000,
  });
});

test.each([
  ["short", "short"],
  ["a".repeat(79_700), "a".repeat(79_700)],
  ["a".repeat(79_701), "a".repeat(79_700)],
  ["Opening paragraph.\n\n" + "a".repeat(80_000), "Opening paragraph."],
])(
  "source projection preserves metadata and paragraph boundaries (%#)",
  (markdown, expected) => {
    const prompt = JSON.parse(
      promptFor(
        { mode: "add", name: "Example Fest", actor: "tester" },
        [],
        [],
        [],
        { searches: 2, durationMs: 1_000 },
        [{ ...source, markdown }],
        "2026-10-08T12:00:00.000Z",
      ),
    );
    expect(prompt.inspectedSources).toEqual([
      {
        url: source.finalUrl,
        status: source.status,
        reasonCode: source.reasonCode,
        markdown: expected,
        truncated: markdown.length > expected.length,
      },
    ]);
  },
);

test("a later tool read gets more cached text than the shared initial projection", async () => {
  const budget = createResearchBudget({}, () => 0);
  const readPage = vi.fn(async () => ({
    ...source,
    markdown: "a".repeat(81_000) + "CACHE_TAIL",
  }));
  const sources = createSourceSession(
    budget,
    { apiKey: "fixture", model: "fixture", limits: budget.limits },
    [],
    { readPage },
  );
  const cached = await sources.readPage(source.attemptedUrl);
  const reads = [
    cached,
    {
      ...source,
      markdown: "short",
      reasonCode: undefined,
    },
  ];
  const prompt = JSON.parse(
    promptFor(
      { mode: "add", name: "Example Fest", actor: "tester" },
      [],
      [],
      [],
      { searches: 2, durationMs: 1_000 },
      reads,
      "2026-10-08T12:00:00.000Z",
    ),
  );
  expect(prompt.inspectedSources[0]).toMatchObject({
    markdown: "a".repeat(39_700),
    truncated: true,
  });
  const tools = createResearchTools(sources, budget, () => ({
    stage: "research",
    step: 1,
    attempt: 1,
  }));
  const later = await tools.readPage.execute!(
    { url: source.finalUrl },
    {} as never,
  );
  expect(later).toMatchObject({
    markdown: "a".repeat(79_700),
    truncated: true,
  });
  expect(readPage).toHaveBeenCalledOnce();
  expect(sources.reads[0]).toBe(cached);
  expect(reads[0].markdown).toHaveLength(81_010);
  expect(reads[0].reasonCode).toBe(source.reasonCode);
  expect(prompt.inspectedSources[1]).toEqual({
    url: source.finalUrl,
    status: source.status,
    markdown: "short",
    truncated: false,
  });
});

test("one frozen instant and saved facts preserve local-day and opaque-key matching inputs", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event();
  fx.edition(event, {
    editionKey: "imported-weekend",
    editionYear: 2026,
    startsOn: "2026-10-10",
    endsOn: "2026-10-11",
    timeZone: "America/Los_Angeles",
    countryCode: "IE",
  });
  fx.edition(event, {
    editionKey: "second-weekend",
    editionYear: 2026,
    countryCode: null,
  });
  const input = {
    mode: "refresh" as const,
    scope: "current" as const,
    eventId: event.id,
    actor: "tester",
  };
  const instant = "2026-10-12T05:00:00.000Z";
  const context = loadResearchContext(client, input, instant);
  const prompt = JSON.parse(
    promptFor(
      input,
      context.catalog,
      context.knownLinks,
      context.terms,
      { searches: 3, durationMs: 300_000 },
      [],
      context.currentDate,
    ),
  );
  expect(context).not.toHaveProperty("refresh");
  expect(prompt).not.toHaveProperty("refresh");
  expect(prompt).not.toHaveProperty("todayUtc");
  expect(prompt.currentDate).toBe(instant);
  expect(prompt.scope).toBe("current");
  expect(prompt.compact.editions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        editionKey: "imported-weekend",
        endsOn: "2026-10-11",
        timeZone: "America/Los_Angeles",
        countryCode: "IE",
      }),
      expect.objectContaining({
        editionKey: "second-weekend",
        editionYear: 2026,
        countryCode: null,
      }),
    ]),
  );
});

test("current narrows research only, preserving complete matching and replacement baselines", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({
    summary: "Saved festival description",
    homeScope: "festivals",
  });
  const old = fx.edition(event, {
    editionKey: "opaque-first-weekend",
    editionYear: 2027,
    venueAddress: "Saved address",
    sizeEstimate: 8000,
    latitude: 53,
    longitude: -6,
    coordinatePrecision: "approximate",
    priceKind: "exact",
    priceCurrency: "KWD",
    priceMinMinor: 1234,
    priceMaxMinor: 1234,
    priceCoverage: "full_programme",
    priceQualification: "Booking fee included",
    priceDetails: [
      {
        label: "Student",
        amount: 0,
        terms: "Student ID",
        availability: "available",
      },
    ],
  });
  fx.edition(event, { editionKey: "opaque-second-weekend", editionYear: 2027 });
  const term = fx.existingTerm("topic", "music");
  fx.assignTerm(old, term);
  const catalog = readResearchCatalog(client);
  const before = structuredClone(catalog);
  const saved = modelContext(catalog[0]);
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "tester",
  };
  const prompt = (scope?: "full" | "current") =>
    JSON.parse(
      promptFor(
        { ...input, scope },
        catalog,
        [],
        [],
        { searches: 3, durationMs: 1000 },
        [],
        "2026-10-11T12:00:00Z",
      ),
    );
  const current = prompt("current");
  expect(prompt().compact).toEqual(saved);
  expect(prompt("full").compact).toEqual(saved);
  expect(
    JSON.parse(
      promptFor(
        { mode: "add", name: "New", actor: "tester" },
        catalog,
        [],
        [],
        { searches: 3, durationMs: 1000 },
        [],
      ),
    ).catalog[0].editions,
  ).toHaveLength(2);
  for (const field of ["summary", "homeScope", "publicationState"]) {
    expect(current.compact).not.toHaveProperty(field);
    expect(saved).toHaveProperty(field);
  }
  for (const edition of current.compact.editions) {
    const full = saved.editions.find(
      (e) => e.editionKey === edition.editionKey,
    )!;
    for (const field of ["publicationState", "venueAddress", "sizeEstimate"]) {
      expect(edition).not.toHaveProperty(field);
      expect(full).toHaveProperty(field);
    }
    expect(edition).toEqual(
      Object.fromEntries(
        Object.entries(full).filter(
          ([key]) =>
            !["publicationState", "venueAddress", "sizeEstimate"].includes(key),
        ),
      ),
    );
  }
  expect(
    current.compact.editions.find(
      (e: { editionKey: string }) => e.editionKey === old.editionKey,
    ).tickets,
  ).toEqual(
    saved.editions.find((e) => e.editionKey === old.editionKey)!.tickets,
  );
  expect(JSON.stringify(current).length).toBeLessThan(
    JSON.stringify(prompt("full")).length,
  );
  expect(catalog).toEqual(before);
});

function assignment(input: CatalogResearchInput) {
  return JSON.parse(
    promptFor(input, [], [], [], { searches: 3, durationMs: 600_000 }, []),
  );
}

test.each([
  { mode: "add", name: "New", actor: "tester" },
  { mode: "refresh", scope: "full", eventId: "saved", actor: "tester" },
  { mode: "refresh", scope: "current", eventId: "saved", actor: "tester" },
  { mode: "refresh", eventId: "saved", actor: "tester" },
] satisfies CatalogResearchInput[])(
  "serialized research input selects only its assignment: %j",
  (input) => {
    const prompt = assignment(input);
    const mode =
      input.mode === "add"
        ? "add"
        : input.scope === "current"
          ? "refresh/current"
          : "refresh/full";
    for (const candidate of ["add", "refresh/full", "refresh/current"]) {
      expect(prompt.task.includes(`Assignment: ${candidate}.`)).toBe(
        candidate === mode,
      );
    }
    expect(prompt.scope).toBe(
      input.mode === "add" ? null : (input.scope ?? "full"),
    );
    expect(prompt.task).toContain("For every unknown nullable fact");
    expect(prompt.task).toContain(
      "Follow relevant known links and prior results first",
    );
    expect(prompt.task).toContain(
      "Within the assignment limits, use searchWeb",
    );
    expect(prompt.task).toContain(
      "When you find at least one supported price for an Edition in this assignment",
    );
    expect(prompt.task).toContain("do not copy saved offers or prices");
    if (mode === "refresh/current") {
      expect(prompt.task).toContain(
        "Do not search for or inspect replacement websites",
      );
      expect(prompt.task).toContain("can succeed with both Edition slots null");
      expect(prompt.task).toContain("reason names the donor editionKey");
      expect(prompt.task).toContain("Always use previousEdition:null");
      expect(prompt.task).not.toContain("Full checks");
      expect(prompt.task).not.toContain(
        "recover wrong websites within this run",
      );
    } else {
      expect(prompt.task).not.toContain(
        "Do not search for or inspect replacement websites",
      );
      expect(prompt.task).not.toContain(
        "can succeed with both Edition slots null",
      );
      expect(prompt.task).not.toContain("Current MUST omit");
      expect(prompt.task).not.toContain("Current scope only");
      expect(prompt.task).not.toContain("Always use previousEdition:null");
      expect(prompt.task).not.toContain("current requires failed/null");
      expect(prompt.task).not.toContain("no replacement-site search");
      if (mode === "refresh/full") {
        expect(prompt.task).toContain("the latest completed Edition");
        expect(prompt.task).toContain("recover wrong websites within this run");
        expect(prompt.task).not.toContain("Select an existing Event for add");
      } else {
        expect(prompt.task).toContain("Select an existing Event for add");
        expect(prompt.task).not.toContain("Full scope only");
      }
    }
  },
);

test("omitted refresh scope uses exactly the explicit full instructions", () => {
  const input = { mode: "refresh" as const, eventId: "saved", actor: "tester" };
  expect(assignment(input).task).toBe(
    assignment({ ...input, scope: "full" }).task,
  );
});

test.each(["add", "full", "current"] as const)(
  "%s receives only the applicable Edition selection rules",
  (mode) => {
    const task = assignment(
      mode === "add"
        ? { mode, name: "New", actor: "tester" }
        : { mode: "refresh", scope: mode, eventId: "saved", actor: "tester" },
    ).task;
    for (const rule of [
      "latest Edition that actually finished before the reference local day",
      "not necessarily the previous calendar year",
      "Cancellation or postponement without a completed programme",
      "completion without exact dates",
      "An empty previousEdition slot alone does not justify search",
      "A recurring Event description alone does not establish a specific past Edition",
    ]) {
      expect(task.includes(rule)).toBe(mode !== "current");
    }
    for (const rule of [
      "On the final local date it is still current",
      "the first start date, and the last end date",
      "during a gap it is still ongoing",
      "Other saved history and farther future Editions are context",
    ]) {
      expect(task).toContain(rule);
    }
    expect(task).not.toContain("EVERY saved Edition");
    expect(task).not.toContain("at most 20");
  },
);

import { editorInstructions } from "@/test/ingestion-fixtures/editor-prompt";

test("both models receive the same classification rules", () => {
  for (const text of [
    assignment({ mode: "add", name: "New", actor: "tester" }).task,
    editorInstructions,
  ]) {
    for (const rule of [
      "at most one event_type and at most one format",
      "topic, genre, and culture can each have multiple terms",
      "main programme comes from participants' contributions",
      "Community wording, workshops, or shared activities alone",
      "prefer festival if the organizer explicitly calls the Edition a festival",
      "a festival with music, workshops, and a community gathering uses one festival type",
      "open site is the primary setting",
      "enclosed spaces are the primary setting",
      "mixed takes precedence",
      "single roof or enclosure alone",
      "omit format or preserve saved classification",
    ]) {
      expect(text).toContain(rule);
    }
  }
  expect(editorInstructions).toContain(
    "Never accept a classification list that exceeds a facet limit",
  );
});

test("research owns search policy and the tool describes search results", () => {
  const budget = createResearchBudget({}, () => 0);
  const sources = createSourceSession(
    budget,
    { apiKey: "fixture", model: "fixture", limits: budget.limits },
    [],
    {},
  );
  const tools = createResearchTools(sources, budget, () => ({
    stage: "research",
    step: 1,
    attempt: 1,
  }));
  for (const input of [
    { mode: "add", name: "New", actor: "tester" },
    { mode: "refresh", scope: "full", eventId: "saved", actor: "tester" },
    { mode: "refresh", scope: "current", eventId: "saved", actor: "tester" },
  ] satisfies CatalogResearchInput[]) {
    const task = assignment(input).task;
    expect(task).not.toContain(tools.searchWeb.description);
    for (const rule of [
      "essential missing fact about an Edition supported by inspected evidence",
      "Edition identification, dates or publication requirements",
      "known links and prior results first",
      "no announcement, alone do not justify search",
      "Permission does not require search",
    ]) {
      expect(task).toContain(rule);
      expect(tools.searchWeb.description).not.toContain(rule);
    }
  }
  expect(tools.searchWeb.description).toContain(
    "query allowed by the research assignment",
  );
  expect(tools.searchWeb.description).toContain(
    "inspect a destination with readPage",
  );
  expect(tools.searchWeb.description).toContain("shared search budget");
  expect(tools.searchWeb.description).not.toContain("failed");
  expect(tools.searchWeb.description).not.toContain("Edition");
});
