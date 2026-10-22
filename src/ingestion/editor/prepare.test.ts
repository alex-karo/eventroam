import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput } from "../contracts";
import type { ResearchCandidate } from "../research/contracts";
import { prepareEditorialFixture } from "@/test/ingestion";

const input: CatalogResearchInput = {
  mode: "add",
  name: "Example Fest",
  actor: "catalog-research",
  initiatedBy: "owner",
};
const candidate = (): ResearchCandidate => ({
  status: "success",
  errors: [],
  unresolved: [],
  data: {
    eventName: "Example Fest",
    reason: "Official organizer identifies this festival",
    sources: [],
    links: { socials: {} },
    editions: [{ key: "2027", links: {} }],
  },
});
const create = () => {
  const client = testDatabase().client;
  const proposed = candidate();
  const prepared = prepareEditorialFixture(proposed, [], input, []);
  const applied = applyCatalogItem(client, prepared.operations);
  return { client, eventId: applied.references.event };
};

test.each([
  ["Sónar", "sonar"],
  ["So\u0301nar", "sonar"],
  ["Ｆｅｓｔ ２０２７", "fest-2027"],
  ["音楽祭", /^event-[a-f0-9]{12}$/],
])(
  "creates %s with a normalized slug and unchanged name",
  (eventName, expected) => {
    const client = testDatabase().client;
    const proposed = candidate();
    proposed.data!.eventName = eventName;
    const prepared = prepareEditorialFixture(proposed, [], input, []);
    expect(prepared.errors).toEqual([]);
    applyCatalogItem(client, prepared.operations);
    const [saved] = readResearchCatalog(client);
    expect(saved.canonicalName).toBe(eventName);
    expect(saved.slug).toMatch(expected);
  },
);

test("failed research and invalid target produce no operations", () => {
  const failed: ResearchCandidate = {
    status: "failed",
    data: null,
    errors: [{ code: "source_blocked", message: "Page unavailable" }],
    unresolved: [],
  };
  const preparedFailed = prepareEditorialFixture(failed, [], input, []);
  expect(preparedFailed.operations).toEqual([]);
  expect(preparedFailed.validation).toEqual({
    structural: "passed",
    target: "not_run",
  });
  const { client, eventId } = create();
  const proposed = candidate();
  proposed.data!.eventId = "wrong";
  const result = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId },
    [],
  );
  expect(result.candidate).toBeNull();
  expect(result.operations).toEqual([]);
  expect(result.matchedEventId).toBeUndefined();
  expect(result.errors[0].stage).toBe("validation");
  expect(result.validation).toEqual({ structural: "passed", target: "failed" });
});

test("preparation accepts source summaries beyond the former page cap", () => {
  const malformed = prepareEditorialFixture({}, [], input, []);
  expect(malformed.validation).toEqual({
    structural: "failed",
    target: "not_run",
  });
  const proposed = candidate();
  proposed.data!.sources = Array.from({ length: 21 }, (_, index) => ({
    url: `https://example.org/source-${index}`,
    information: "Info",
  }));
  const overBudget = prepareEditorialFixture(proposed, [], input, []);
  expect(overBudget.validation).toEqual({
    structural: "passed",
    target: "passed",
  });
  expect(overBudget.candidate).not.toBeNull();
});

test("add with recognized existing ID skips every proposed update and logs name difference", () => {
  const { client, eventId } = create();
  const proposed = candidate();
  proposed.data = {
    ...proposed.data!,
    eventId,
    eventName: "Changed Fest",
    summary: { value: "Changed summary", reason: "Official revision" },
    links: { website: "https://new.example/", socials: {} },
    editions: [
      {
        key: "2027",
        year: { value: 2027, reason: "Official year" },
        tickets: {
          value: {
            variants: [{ label: "Regular", availability: "available" }],
            basePrice: null,
          },
          reason: "Official ticket page",
        },
        links: { tickets: "https://tickets.example/" },
      },
    ],
  };
  const result = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    input,
    [],
  );
  expect(result.skipped).toBe(true);
  expect(result.validation).toEqual({ structural: "passed", target: "passed" });
  expect(result.matchedEventId).toBe(eventId);
  expect(result.operations).toEqual([]);
  expect(result.eventNameMismatch).toEqual({
    eventId,
    storedName: "Example Fest",
    observedName: "Changed Fest",
  });
});

test("refresh maps grouped facts and reasons while preserving saved name", () => {
  const { client, eventId } = create();
  const proposed = candidate();
  proposed.data!.eventId = eventId;
  proposed.data!.eventName = "Observed New Name";
  proposed.data!.editions = [
    {
      key: "2027",
      year: { value: 2027, reason: "Programme year" },
      dates: {
        value: {
          startsOn: "2027-06-10",
          endsOn: "2027-06-12",
          state: "confirmed",
        },
        reason: "Confirmed programme window",
      },
      coordinates: {
        value: { latitude: 10, longitude: 20, precision: "exact" },
        reason: "Venue map",
      },
      venueName: { value: "Main Field", reason: "Organizer moved venue" },
      links: {},
    },
  ];
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId },
    [],
  );
  expect(prepared.errors).toEqual([]);
  const update = prepared.operations.find((op) => op.kind === "updateEdition");
  expect(update).toMatchObject({
    data: {
      editionYear: 2027,
      startsOn: "2027-06-10",
      endsOn: "2027-06-12",
      dateState: "confirmed",
      latitude: 10,
      longitude: 20,
      coordinatePrecision: "exact",
      venueName: "Main Field",
    },
  });
  expect(prepared.explanations[update!.operationKey]).toMatchObject({
    starts_on: ["Confirmed programme window"],
    ends_on: ["Confirmed programme window"],
    date_state: ["Confirmed programme window"],
    latitude: ["Venue map"],
    venue_name: ["Organizer moved venue"],
  });
  applyCatalogItem(client, prepared.operations);
  const [saved] = readResearchCatalog(client);
  expect(saved.canonicalName).toBe("Example Fest");
  expect(saved.editions[0].startsOn).toBe("2027-06-10");
});

test("complete nullable groups clear both components and preserve zone", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.edition(event, {
    editionKey: "2027",
    editionYear: 2027,
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
    dateState: "confirmed",
    scheduleStatus: "postponed",
    latitude: 10,
    longitude: 20,
    coordinatePrecision: "exact",
    timeZone: "Europe/Lisbon",
  });
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.editions = [
    {
      key: "2027",
      dates: { value: null, reason: "Dates withdrawn" },
      coordinates: { value: null, reason: "Venue withdrawn" },
      links: {},
    },
  ];
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  const op = prepared.operations.find((item) => item.kind === "updateEdition");
  expect(op).toMatchObject({
    data: {
      startsOn: null,
      endsOn: null,
      dateState: "unknown",
      latitude: null,
      longitude: null,
      coordinatePrecision: "unknown",
    },
  });
  applyCatalogItem(client, prepared.operations);
  const saved = readResearchCatalog(client)[0].editions[0];
  expect(saved.timeZone).toBe("Europe/Lisbon");
  expect(saved.startsOn).toBeNull();
});

test.each([
  { owner: "event", multiple: false },
  { owner: "event", multiple: true },
  { owner: "edition", multiple: false },
  { owner: "edition", multiple: true },
] as const)(
  "$owner supplied link slot replaces all matching links, preserves other slots and normalizes equivalent URLs (multiple=$multiple)",
  ({ owner, multiple }) => {
    const client = testDatabase().client;
    const fx = testFixtures(client);
    const event = fx.event({ canonicalName: "Example Fest" });
    const edition = fx.edition(event, {
      editionKey: "2027",
      editionYear: 2027,
    });
    const website = "https://site.example/";
    const tickets = "https://tickets.example/";
    const instagram = "https://instagram.com/example";
    fx.eventLink(event, {
      kind: "official_site",
      url: website,
      official: true,
    });
    fx.eventLink(event, { kind: "instagram", url: instagram, official: true });
    fx.editionLink(edition, {
      kind: "ticketing",
      url: tickets,
      official: true,
    });
    if (multiple) {
      if (owner === "event") {
        fx.eventLink(event, {
          kind: "official_site",
          url: "https://other.example/",
          official: true,
        });
      } else {
        fx.editionLink(edition, {
          kind: "ticketing",
          url: "https://other.example/",
          official: true,
        });
      }
    }
    const proposed = candidate();
    proposed.data!.eventId = event.id;
    if (owner === "event") {
      proposed.data!.links.website = "https://SITE.example:443/#fragment";
    } else {
      proposed.data!.editions[0].links.tickets =
        "https://TICKETS.example:443/#fragment";
    }
    const refreshInput = {
      ...input,
      mode: "refresh" as const,
      eventId: event.id,
    };
    const prepared = prepareEditorialFixture(
      proposed,
      readResearchCatalog(client),
      refreshInput,
      [],
    );
    expect(prepared.errors).toEqual([]);
    expect(
      prepared.operations.filter((op) => op.kind === "replaceLinks"),
    ).toHaveLength(1);
    if (multiple) {
      applyCatalogItem(client, prepared.operations);
    }
    const saved = readResearchCatalog(client)[0];
    expect(
      saved.links
        .filter((link) => link.kind === "official_site")
        .map((link) => link.url),
    ).toEqual([website]);
    expect(
      saved.links
        .filter((link) => link.kind === "instagram")
        .map((link) => link.url),
    ).toEqual([instagram]);
    expect(
      saved.editions[0].links
        .filter((link) => link.kind === "ticketing")
        .map((link) => link.url),
    ).toEqual([tickets]);
    if (owner === "event") {
      proposed.data!.links.website = "https://new.example/";
    } else {
      proposed.data!.editions[0].links.tickets = "https://new.example/";
    }
    const changed = prepareEditorialFixture(
      proposed,
      readResearchCatalog(client),
      refreshInput,
      [],
    );
    applyCatalogItem(client, changed.operations);
    const updated = readResearchCatalog(client)[0];
    const updatedLinks =
      owner === "event" ? updated.links : updated.editions[0].links;
    expect(
      updatedLinks
        .filter(
          (link) =>
            link.kind === (owner === "event" ? "official_site" : "ticketing"),
        )
        .map((link) => link.url),
    ).toEqual(["https://new.example/"]);
    expect(
      updated.links
        .filter((link) => link.kind === "instagram")
        .map((link) => link.url),
    ).toEqual([instagram]);
  },
);

test("base prices convert major to minor and variants retain major", () => {
  for (const [currency, amount, expected] of [
    ["EUR", 100.5, 10050],
    ["JPY", 1000, 1000],
    ["KWD", 1.234, 1234],
  ] as const) {
    const proposed = candidate();
    proposed.data!.editions[0].tickets = {
      value: {
        variants: [{ label: "Regular", amount, currency }],
        basePrice: {
          kind: "exact",
          currency,
          minAmount: amount,
          maxAmount: amount,
          coverage: "full_programme",
        },
      },
      reason: "Official ticket price",
    };
    const prepared = prepareEditorialFixture(proposed, [], input, []);
    const op = prepared.operations.find(
      (item) => item.kind === "replacePriceBlock",
    );
    expect(op).toMatchObject({
      basePrice: { minMinor: expected, maxMinor: expected },
      priceDetails: [{ amount }],
    });
  }
});

test("reordered qualified ticket variants and an equivalent base price produce no audit changes", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const variants = [
    {
      label: "Weekend package",
      amount: 120,
      currency: "EUR",
      terms: "Camping included",
      availability: "available" as const,
    },
    {
      label: "Child day",
      amount: 0,
      currency: "EUR",
      terms: "Under 12; one day",
      availability: "available" as const,
    },
    {
      label: "Upgrade",
      amount: 20,
      currency: "EUR",
      terms: "Requires weekend ticket",
      availability: "sold_out" as const,
    },
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  fx.edition(event, {
    editionKey: "2027",
    priceKind: "exact",
    priceCurrency: "EUR",
    priceMinMinor: 12000,
    priceMaxMinor: 12000,
    priceCoverage: "full_programme",
    priceDetails: variants,
  });
  const proposed = candidate();
  proposed.data!.editions[0].tickets = {
    value: {
      variants: [...variants].reverse(),
      basePrice: {
        kind: "exact",
        currency: "EUR",
        minAmount: 120,
        maxAmount: 120,
        coverage: "full_programme",
      },
    },
    reason: "Official shop confirms all ticket categories",
  };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  expect(prepared.errors).toEqual([]);
  const applied = applyCatalogItem(client, prepared.operations);
  expect(applied.changes).toEqual([]);
  expect(readResearchCatalog(client)[0].editions[0].priceDetails).toEqual(
    variants,
  );
  expect(client.prepare("SELECT * FROM catalog_changes").all()).toEqual([]);
});

test("classification finding replaces explicitly refuted assignments", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.edition(event, { editionKey: "2027" });
  const old = fx.term({ slug: "old" });
  const newTerm = fx.term({ slug: "new" });
  fx.assignTerm(edition, old);
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.editions[0].classification = {
    value: [newTerm.id],
    reason: "New classification replaces explicitly refuted old classification",
  };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [old, newTerm],
  );
  expect(
    prepared.operations.find((op) => op.kind === "replaceTerms"),
  ).toMatchObject({ termIds: [newTerm.id] });
  const termsOp = prepared.operations.find((op) => op.kind === "replaceTerms")!;
  expect(prepared.explanations[termsOp.operationKey].terms).toEqual([
    "New classification replaces explicitly refuted old classification",
  ]);
  applyCatalogItem(client, prepared.operations);
  expect(
    readResearchCatalog(client)[0].editions[0].terms.map((term) => term.id),
  ).toEqual([newTerm.id]);
});

test("omitted tickets and independent facts preserve saved values after relocation", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.edition(event, {
    editionKey: "2027",
    venueName: "Old Field",
    locality: "Old City",
    timeZone: "Europe/Lisbon",
    priceDetails: [{ label: "Regular", amount: 20, currency: "EUR" }],
  });
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.status = "partial";
  proposed.unresolved = [
    {
      editionKey: "2027",
      field: "tickets",
      message: "Unread shop category; cannot replace complete block",
    },
  ];
  proposed.data!.editions[0].venueName = {
    value: "New Field",
    reason: "Organizer moved venues",
  };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  applyCatalogItem(client, prepared.operations);
  const saved = readResearchCatalog(client)[0].editions[0];
  expect(prepared.unresolved).toEqual(proposed.unresolved);
  expect(saved.venueName).toBe("New Field");
  expect(saved.locality).toBe("Old City");
  expect(saved.timeZone).toBe("Europe/Lisbon");
  expect(saved.priceDetails).toEqual([
    { label: "Regular", amount: 20, currency: "EUR" },
  ]);
});

test("same ticket URL can be assigned to two editions independently", () => {
  const proposed = candidate();
  proposed.data!.editions = [
    { key: "2027", links: { tickets: "https://tickets.example/all" } },
    { key: "2028", links: { tickets: "https://tickets.example/all" } },
  ];
  const prepared = prepareEditorialFixture(proposed, [], input, []);
  const links = prepared.operations.filter((op) => op.kind === "replaceLinks");
  expect(links).toHaveLength(2);
  expect(links.map((op) => op.owner.id)).toEqual(["$edition_0", "$edition_1"]);
});

test("writer rejection rolls back a supplied link replacement", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.edition(event, {
    editionKey: "2027",
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
    scheduleStatus: "scheduled",
  });
  fx.eventLink(event, {
    kind: "official_site",
    url: "https://old.example/",
    official: true,
  });
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.links.website = "https://new.example/";
  proposed.data!.editions[0].dates = {
    value: null,
    reason: "Official dates withdrawn",
  };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  expect(() => applyCatalogItem(client, prepared.operations)).toThrow();
  expect(readResearchCatalog(client)[0].links[0].url).toBe(
    "https://old.example/",
  );
});

test("explicit cancellation updates schedule without renaming Event identity", () => {
  const { client, eventId } = create();
  const original = readResearchCatalog(client)[0];
  const proposed = candidate();
  proposed.data!.eventId = eventId;
  proposed.data!.eventName = "Changed Name";
  proposed.data!.editions[0].scheduleStatus = {
    value: "cancelled",
    reason: "Organizer cancelled this edition",
  };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId },
    [],
  );
  const op = prepared.operations.find((item) => item.kind === "updateEdition")!;
  expect(op).toMatchObject({ data: { scheduleStatus: "cancelled" } });
  expect(prepared.explanations[op.operationKey].schedule_status).toEqual([
    "Organizer cancelled this edition",
  ]);
  applyCatalogItem(client, prepared.operations);
  const saved = readResearchCatalog(client)[0];
  expect(saved.canonicalName).toBe(original.canonicalName);
  expect(saved.aliases).toEqual(original.aliases);
  expect(saved.slug).toBe(original.slug);
});

test.each([
  ["openair", true, true],
  ["mixed-indoor-outdoor", true, true],
  ["indoor", true, false],
  ["outdoor", true, false],
  [null, true, false],
  ["openair", false, false],
] as const)(
  "research and writer agree on format %s with music=%s despite the outdoor activity topic",
  (format, music, publishable) => {
    const client = testDatabase().client;
    const fx = testFixtures(client);
    const terms = [
      fx.existingTerm("event_type", "festival"),
      fx.existingTerm("topic", "outdoor"),
    ];
    if (format) {
      terms.push(
        format === "outdoor"
          ? fx.term({ facet: "format", slug: format })
          : fx.existingTerm("format", format),
      );
    }
    if (music) {
      terms.push(fx.existingTerm("topic", "music"));
    }
    const proposed = candidate();
    proposed.data!.editions = [
      {
        key: "2027",
        year: { value: 2027, reason: "Official edition year" },
        dates: {
          value: {
            startsOn: "2027-06-10",
            endsOn: "2027-06-12",
            state: "confirmed",
          },
          reason: "Official programme dates",
        },
        countryCode: { value: "PT", reason: "Official venue" },
        locality: { value: "Lisbon", reason: "Official venue" },
        classification: {
          value: terms.map((term) => term.id),
          reason: "Official programme and activity offerings",
        },
        links: {},
      },
    ];
    const prepared = prepareEditorialFixture(proposed, [], input, terms);
    expect(prepared.errors).toEqual([]);
    expect(prepared.operations.some((op) => op.kind === "publishEdition")).toBe(
      publishable,
    );
    applyCatalogItem(client, prepared.operations);
    const [saved] = readResearchCatalog(client);
    const edition = saved.editions[0];
    expect(edition.publicationState).toBe(publishable ? "published" : "draft");
    expect(edition.terms.map((term) => term.id).sort()).toEqual(
      terms.map((term) => term.id).sort(),
    );
    if (!publishable) {
      expect(() =>
        applyCatalogItem(client, [
          {
            kind: "publishEdition",
            operationKey: "test:activity-publication",
            actor: "owner",
            id: edition.id,
            expectedVersion: edition.version,
          },
        ]),
      ).toThrow(music ? /format/ : /music or burning-like/);
    }
  },
);

test("research size survives context, preparation, writer and omission", () => {
  const { client, eventId } = create();
  const proposed = candidate();
  proposed.data!.eventId = eventId;
  proposed.data!.editions[0].sizeEstimate = {
    value: 8000,
    reason: "2026 participant count supports this edition estimate",
  };
  const refresh = { ...input, mode: "refresh" as const, eventId };
  const prepared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    refresh,
    [],
  );
  expect(prepared.errors).toEqual([]);
  applyCatalogItem(client, prepared.operations);
  expect(readResearchCatalog(client)[0].editions[0].sizeEstimate).toBe(8000);
  delete proposed.data!.editions[0].sizeEstimate;
  const omitted = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    refresh,
    [],
  );
  expect(omitted.operations.every((op) => op.kind === "replaceLinks")).toBe(
    true,
  );
  expect(readResearchCatalog(client)[0].editions[0].sizeEstimate).toBe(8000);
  proposed.data!.editions[0].sizeEstimate = {
    value: null,
    reason: "Organizer explicitly withdrew its participant estimate",
  };
  const cleared = prepareEditorialFixture(
    proposed,
    readResearchCatalog(client),
    refresh,
    [],
  );
  applyCatalogItem(client, cleared.operations);
  expect(readResearchCatalog(client)[0].editions[0].sizeEstimate).toBeNull();
});
