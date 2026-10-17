import { expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolOutputCapture } from "../../tool-output-capture";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { createResearchBudget } from "../../runtime/budget";
import type { ReadPageResult } from "../../tools/read-page/contracts";
import { modelContext, promptFor } from "./input";
import type { CatalogResearchInput } from "../../contracts";
import { loadResearchContext } from "../context";

const source: ReadPageResult = {
  attemptedUrl: "https://example.org/announcement",
  finalUrl: "https://example.org/2027",
  retrievedAt: "2026-10-08T12:00:00Z",
  method: "http",
  outcome: "partial",
  reason: "Only announcement text was readable",
  completeness: "partial",
  markdown: "Example Fest 2027.\n\nTicket information follows.",
  links: ["https://example.org/tickets"],
  httpStatus: 200,
  sourceTruncated: true,
};

test("captured initial source is the same bounded projection as the prompt", () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-initial-"));
  try {
    const capture = new ToolOutputCapture("run-1", root);
    const prompt = JSON.parse(
      promptFor(
        { mode: "add", name: "Example Fest", actor: "tester" },
        [],
        [],
        [],
        { searches: 2, durationMs: 1_000 },
        [{ ...source, markdown: "A".repeat(81_000) }],
        "2026-10-08T12:00:00.000Z",
        (inspectedSources) => {
          for (const inspected of inspectedSources) {
            capture.save(capture.reserve(), "initial-source", inspected);
          }
        },
      ),
    );
    const json = JSON.parse(
      readFileSync(join(root, "run-1", "00001-initial-source.json"), "utf8"),
    );
    expect(json.result).toEqual(prompt.inspectedSources[0]);
    expect(json.result.markdown).toHaveLength(79_700);
    expect(
      readFileSync(join(root, "run-1", "00001-initial-source.md"), "utf8"),
    ).toBe(json.result.markdown);
    expect(json.result).not.toHaveProperty("httpStatus");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
        attemptedUrl: source.attemptedUrl,
        finalUrl: source.finalUrl,
        retrievedAt: source.retrievedAt,
        outcome: source.outcome,
        reason: source.reason,
        markdown: expected,
        truncated: markdown.length > expected.length,
        completeness: "partial",
      },
    ]);
  },
);

test("initial sources share the existing prompt content allowance", () => {
  const reads = [
    { ...source, markdown: "a".repeat(40_000), completeness: "full" as const },
    {
      ...source,
      markdown: "short",
      reason: undefined,
      completeness: "full" as const,
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
    completeness: "partial",
  });
  expect(prompt.inspectedSources[1]).toEqual({
    attemptedUrl: source.attemptedUrl,
    finalUrl: source.finalUrl,
    retrievedAt: source.retrievedAt,
    outcome: source.outcome,
    markdown: "short",
    truncated: false,
    completeness: "full",
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
  const term = fx.term({ facet: "topic", slug: "music" });
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
      "Follow relevant known links first. Use searchWeb only under its stated conditions.",
    );
    expect(prompt.task).toContain(
      "tickets.value is one complete findings block",
    );
    if (mode === "refresh/current") {
      expect(prompt.task).toContain(
        "Do not search for or inspect replacement websites",
      );
      expect(prompt.task).toContain("can succeed with editions:[]");
      expect(prompt.task).toContain("reason names the donor editionKey");
      expect(prompt.task).not.toContain("Full checks");
      expect(prompt.task).not.toContain(
        "recover wrong websites within this run",
      );
    } else {
      expect(prompt.task).not.toContain(
        "Do not search for or inspect replacement websites",
      );
      expect(prompt.task).not.toContain("can succeed with editions:[]");
      expect(prompt.task).not.toContain("Current MUST omit");
      if (mode === "refresh/full") {
        expect(prompt.task).toContain("EVERY saved Edition");
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
