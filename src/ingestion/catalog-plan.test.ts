import { assert, expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { prepareCatalogPlan } from "./catalog-plan";
import { initialDiagnostics } from "./proposals";
import {
  readResearchEvent,
  readResearchCatalog,
} from "@/catalog/read/research";
import {
  fixtureDependencies,
  fixtureTargets,
  fixtureDescriptionRole,
  fixtureLocationPlan,
  set,
  clear,
  runFixtureResearch,
} from "@/test/ingestion";

const input = {
  mode: "add" as const,
  input: "Example Fest",
  actor: "catalog-research",
  dryRun: false,
};
function fixture(scheduleStatus: "announced" | "scheduled" = "announced") {
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const event = fx.event({
    canonicalName: "Example Fest",
    description: "Saved description",
  });
  const edition = fx.edition(event, {
    editionKey: "2027",
    editionYear: 2027,
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
    dateState: "confirmed",
    scheduleStatus,
    countryCode: "PT",
    locality: "Lisbon",
    timeZone: "Europe/Lisbon",
    sizeEstimate: 12000,
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate",
  });
  const general = fixtureTargets(event.id);
  general.currentOrNextEdition!.fields = {};
  const refresh = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: input.actor,
    dryRun: false,
  };
  const deps = {
    ...fixtureDependencies({ general }),
    client,
    todayUtc: "2026-11-01",
    geocodingClient: async () => ({
      status: "error" as const,
      code: "provider_error" as const,
    }),
  };
  return { client, fx, event, edition, general, refresh, deps };
}
test.each([
  ["Sónar", "sonar"],
  ["So\u0301nar", "sonar"],
  ["Ｆｅｓｔ ２０２７", "fest-2027"],
  ["音楽祭", /^event-[a-f0-9]{12}$/],
])(
  "creates %s with a normalized slug and unchanged name",
  async (name, slug) => {
    const { client } = testDatabase();
    const general = fixtureTargets();
    general.observedEventName = name as string;
    const result = await runFixtureResearch(
      { ...input, input: name as string },
      { client, ...fixtureDependencies({ general }) },
    );
    expect(result.errors).toEqual([]);
    expect(readResearchCatalog(client)[0].canonicalName).toBe(name);
    expect(readResearchCatalog(client)[0].slug).toMatch(slug);
  },
);
test("duplicate add stops all role proposals before writes and retains the observed name", async () => {
  const f = fixture();
  const before = readResearchEvent(f.client, f.event.id);
  const result = await runFixtureResearch(input, {
    ...f.deps,
    generateRoles: {
      general: async () => ({
        decision: "duplicate",
        eventId: f.event.id,
        observedEventName: "Revised name",
        reason: "Same organizer and Event",
        evidenceIds: ["s1-e1"],
      }),
    },
  });
  expect(result.outcome).toBe("skipped");
  expect(result.operations).toEqual([]);
  expect(result.eventNameMismatch?.observedName).toBe("Revised name");
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
});
test("Ingestion maps grouped facts and reasons without renaming the saved Event", async () => {
  const f = fixture();
  f.general.observedEventName = "Observed name";
  const classification = fixtureDescriptionRole({
    description: set("Updated description", "Official description"),
    shortDescription: set("Example Fest is a music festival.", "Preview text"),
  });
  f.general.currentOrNextEdition!.fields = {
    dates: set(
      { startsOn: "2027-06-10", endsOn: "2027-06-20", state: "provisional" },
      "Programme dates",
    ),
    sizeEstimate: set(15000, "Organizer attendance"),
  };
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateRoles: { classification },
  });
  expect(result.errors).toEqual([]);
  expect(result.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: "description",
        explanations: ["Official description"],
      }),
      expect.objectContaining({
        field: "short_description",
        explanations: ["Preview text"],
      }),
    ]),
  );
  const saved = readResearchEvent(f.client, f.event.id)!;
  expect(saved.canonicalName).toBe("Example Fest");
  expect(saved.description).toBe("Updated description");
  expect(saved.editions[0]).toMatchObject({
    startsOn: "2027-06-10",
    endsOn: "2027-06-20",
    dateState: "provisional",
    sizeEstimate: 15000,
    timeZone: "Europe/Lisbon",
  });
  expect(result.changes).toContainEqual(
    expect.objectContaining({
      field: "starts_on",
      explanations: ["Programme dates"],
    }),
  );
});
test("explicit date, point and size clears preserve the saved time zone and country", async () => {
  const f = fixture();
  f.general.currentOrNextEdition!.fields = {
    dates: clear(),
    scheduleStatus: set("announced"),
    sizeEstimate: clear(),
  };
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateLocation: async (raw) => {
      const plan = fixtureLocationPlan(JSON.parse(raw));
      if (plan.decision.status === "ready") {
        plan.decision.currentOrNextEdition!.coordinates = {
          action: "clear",
          reason: "Old point was refuted",
        };
        plan.decision.currentOrNextEdition!.evidenceIds = ["s1-e1"];
      }
      return plan;
    },
  });
  expect(result.errors).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0]).toMatchObject({
    startsOn: null,
    endsOn: null,
    dateState: "unknown",
    latitude: null,
    longitude: null,
    coordinatePrecision: "unknown",
    sizeEstimate: null,
    countryCode: "PT",
    timeZone: "Europe/Lisbon",
  });
});
test("Tickets converts base prices to minor units and retains free concessions without currency", async () => {
  const f = fixture();
  const tickets = {
    currentOrNextEdition: {
      tickets: set({
        variants: [
          { label: "Weekend", amount: 100.5, currency: "EUR" },
          { label: "Children", amount: 0 },
        ],
        basePrice: {
          kind: "exact",
          currency: "EUR",
          minAmount: 100.5,
          maxAmount: 100.5,
          coverage: "full_programme",
        },
      }),
    },
    checks: [],
    unresolved: [],
  };
  const deps = { ...f.deps, generateRoles: { tickets: async () => tickets } };
  const result = await runFixtureResearch(f.refresh, deps);
  expect(result.errors).toEqual([]);
  const saved = readResearchEvent(f.client, f.event.id)!.editions[0];
  expect(saved.priceMinMinor).toBe(10050);
  expect(saved.priceDetails).toContainEqual(
    expect.objectContaining({ label: "Children", amount: 0 }),
  );
  expect(saved.priceDetails).toContainEqual(
    expect.objectContaining({
      label: "Weekend",
      amount: 100.5,
      currency: "EUR",
    }),
  );
  tickets.currentOrNextEdition.tickets.value.variants.reverse();
  const again = await runFixtureResearch(f.refresh, deps);
  expect(again.errors).toEqual([]);
  expect(again.changes).toEqual([]);
});
test("Classification replaces refuted assignments and omits no saved terms by accident", async () => {
  const f = fixture();
  const terms = f.fx.festivalTerms();
  terms.forEach((term) => f.fx.assignTerm(f.edition, term));
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateRoles: {
      classification: async () => ({
        previousEdition: null,
        currentOrNextEdition: { classification: set([]) },
        checks: [],
        unresolved: [],
      }),
    },
  });
  expect(result.errors).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0].terms).toEqual(
    [],
  );
});
test("Location relocation preserves omitted Tickets and independent General fields", async () => {
  const f = fixture();
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateLocation: async (raw) => {
      const plan = fixtureLocationPlan(JSON.parse(raw));
      if (plan.decision.status === "ready") {
        plan.decision.currentOrNextEdition!.fields.venueName = {
          action: "set",
          value: "New grounds",
          reason: "Official relocation",
        };
        plan.decision.currentOrNextEdition!.evidenceIds = ["s1-e1"];
      }
      return plan;
    },
  });
  expect(result.errors).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0]).toMatchObject({
    venueName: "New grounds",
    startsOn: "2027-07-01",
    sizeEstimate: 12000,
    timeZone: "Europe/Lisbon",
  });
});
test("Links clear only the official website and keep other link kinds", async () => {
  const f = fixture();
  f.fx.eventLink(f.event, {
    kind: "official_site",
    url: "https://example.org/",
  });
  f.fx.eventLink(f.event, {
    kind: "instagram",
    url: "https://instagram.com/example",
  });
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateRoles: {
      links: async () => ({
        event: { website: clear(), socials: {} },
        currentOrNextEdition: {},
        checks: [],
        unresolved: [],
        omitted: [],
      }),
    },
  });
  expect(result.errors).toEqual([]);
  expect(
    readResearchEvent(f.client, f.event.id)!.links.map((link) => link.kind),
  ).toEqual(["instagram"]);
});
test("writer rejection rolls back links, data, audit entries and receipts together", async () => {
  const f = fixture();
  f.client.exec(
    "CREATE TRIGGER refuse_description BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'private failure'); END",
  );
  const before = readResearchEvent(f.client, f.event.id);
  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateRoles: {
      classification: fixtureDescriptionRole({
        description: set("New description"),
      }),
      links: async () => ({
        event: { website: set("https://example.org/"), socials: {} },
        currentOrNextEdition: {},
        checks: [],
        unresolved: [],
        omitted: [],
      }),
    },
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "write_failed" }),
  );
  expect(result.receipts).toEqual([]);
  expect(result.changes).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
  expect(f.client.prepare("SELECT * FROM catalog_changes").all()).toEqual([]);
});
test("rejects a new scheduled Edition without dates before writing any changes", async () => {
  const f = fixture();
  const target = f.general.currentOrNextEdition!;
  target.editionKey = "2028";
  target.fields = { year: set(2028), scheduleStatus: set("scheduled") };
  const before = readResearchEvent(f.client, f.event.id);

  const result = await runFixtureResearch(f.refresh, {
    ...f.deps,
    generateRoles: {
      classification: fixtureDescriptionRole({
        description: set("New description"),
      }),
    },
  });

  expect(result.outcome).toBe("failed");
  expect(result.errors).toContainEqual({
    code: "invalid_plan",
    stage: "validation",
    field: "currentOrNextEdition.fields.dates",
    message:
      "Edition 2028 needs a start date and an end date for status scheduled.",
  });
  expect(result.operations).toEqual([]);
  expect(result.receipts).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
});
test("accepts scheduled status when the Edition keeps its saved dates", async () => {
  const f = fixture();
  f.general.currentOrNextEdition!.fields.scheduleStatus = set("scheduled");

  const result = await runFixtureResearch(f.refresh, f.deps);

  expect(result.errors).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0]).toMatchObject({
    scheduleStatus: "scheduled",
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
});
test("rejects clearing dates when the Edition keeps its scheduled status", async () => {
  const f = fixture("scheduled");
  f.general.currentOrNextEdition!.fields.dates = clear();
  const before = readResearchEvent(f.client, f.event.id);

  const result = await runFixtureResearch(f.refresh, f.deps);

  expect(result.outcome).toBe("failed");
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "invalid_plan",
      stage: "validation",
      message:
        "Edition 2027 needs a start date and an end date for status scheduled.",
    }),
  );
  expect(result.operations).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)).toEqual(before);
});
test("cancellation changes schedule status while omission preserves size", async () => {
  const f = fixture();
  f.general.currentOrNextEdition!.fields.scheduleStatus = set(
    "cancelled",
    "Official cancellation",
  );
  const first = await runFixtureResearch(f.refresh, f.deps);
  expect(first.errors).toEqual([]);
  expect(readResearchEvent(f.client, f.event.id)!.editions[0]).toMatchObject({
    scheduleStatus: "cancelled",
    sizeEstimate: 12000,
  });
  const again = await runFixtureResearch(f.refresh, f.deps);
  expect(again.changes).toEqual([]);
});
test("a draft with complete facts and only event_type has no planned publication", () => {
  const f = fixture();
  const terms = f.fx.festivalTerms();
  terms.forEach((term) => f.fx.assignTerm(f.edition, term));
  const eventType = terms.find((term) => term.facet === "event_type")!;
  const keep = { action: "keep" as const, reason: "Preserve saved location" };
  const result = prepareCatalogPlan(
    {
      ...initialDiagnostics(),
      matchedEventId: f.event.id,
      eventName: f.event.canonicalName,
      targets: f.general,
      plan: {
        status: "ready",
        event: { fields: {} },
        previousEdition: null,
        currentOrNextEdition: {
          editionKey: f.edition.editionKey,
          fields: { classification: set([eventType.id]) },
        },
        unresolved: [],
      },
      location: {
        support: {},
        slots: {
          currentOrNextEdition: {
            venueName: keep,
            venueAddress: keep,
            locality: keep,
            administrativeArea: keep,
            countryCode: keep,
            coordinates: keep,
          },
        },
        previousPoints: [],
        unresolved: [],
      },
    },
    readResearchCatalog(f.client),
    f.refresh,
    terms,
  );
  assert(result.status === "continue", "Catalog plan rejected");
  expect(result.value.operations).toContainEqual(
    expect.objectContaining({
      kind: "replaceTerms",
      id: f.edition.id,
      termIds: [eventType.id],
    }),
  );
  expect(
    result.value.operations.some((op) => op.kind === "publishEdition"),
  ).toBe(false);
});

test("a publishable historical Edition publishes the Event while an undated next Edition stays draft", async () => {
  const { client } = testDatabase();
  const terms = testFixtures(client).festivalTerms();
  const general = fixtureTargets();
  general.previousEdition = {
    ...general.currentOrNextEdition!,
    editionKey: "2026",
    fields: {
      year: set(2026),
      dates: set({
        startsOn: "2026-07-01",
        endsOn: "2026-07-03",
        state: "confirmed",
      }),
    },
  };
  general.currentOrNextEdition!.fields = { year: set(2027) };
  const result = await runFixtureResearch(input, {
    client,
    ...fixtureDependencies({
      general,
      classification: {
        previousEdition: { classification: set(terms.map((term) => term.id)) },
        currentOrNextEdition: {},
        checks: [],
        unresolved: [],
      },
    }),
    generateLocation: async (raw) => {
      const plan = fixtureLocationPlan(JSON.parse(raw));
      if (plan.decision.status === "ready") {
        plan.decision.previousEdition!.fields.countryCode = {
          action: "set",
          value: "PT",
          reason: "Official country",
        };
        plan.decision.previousEdition!.evidenceIds = ["s1-e1"];
      }
      return plan;
    },
  });
  expect(result.errors).toEqual([]);
  const saved = readResearchCatalog(client)[0];
  expect(saved.publicationState).toBe("published");
  expect(
    saved.editions.find((e) => e.editionKey === "2026")!.publicationState,
  ).toBe("published");
  expect(
    saved.editions.find((e) => e.editionKey === "2027")!.publicationState,
  ).toBe("draft");
});
