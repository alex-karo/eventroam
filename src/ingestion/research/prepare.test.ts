import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { readResearchCatalog } from "@/catalog/read/research";
import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogResearchInput } from "../contracts";
import type { ResearchCandidate } from "./contracts";
import { prepareResearch } from "./prepare";

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
  const prepared = prepareResearch(proposed, [], input, []);
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
    const prepared = prepareResearch(proposed, [], input, []);
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
  expect(prepareResearch(failed, [], input, []).operations).toEqual([]);
  const { client, eventId } = create();
  const proposed = candidate();
  proposed.data!.eventId = "wrong";
  const result = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId },
    [],
  );
  expect(result.candidate).toBeNull();
  expect(result.operations).toEqual([]);
  expect(result.matchedEventId).toBeUndefined();
  expect(result.errors[0].stage).toBe("validation");
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
  const result = prepareResearch(
    proposed,
    readResearchCatalog(client),
    input,
    [],
  );
  expect(result.skipped).toBe(true);
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
  const prepared = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId },
    [],
  );
  expect(prepared.errors).toEqual([]);
  const update = prepared.operations.find(
    (op) => op.kind === "updateOccurrence",
  );
  expect(update).toMatchObject({
    data: {
      occurrenceYear: 2027,
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
  fx.occurrence(event, {
    occurrenceKey: "2027",
    occurrenceYear: 2027,
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
  const prepared = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "check", eventId: event.id },
    [],
  );
  const op = prepared.operations.find(
    (item) => item.kind === "updateOccurrence",
  );
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

test("supplied link slots replace only matching owner/kind; equivalent sole URL is a no-op", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.occurrence(event, {
    occurrenceKey: "2027",
    occurrenceYear: 2027,
  });
  fx.eventLink(event, {
    kind: "official_site",
    url: "https://old.example/",
    official: true,
  });
  fx.eventLink(event, {
    kind: "official_site",
    url: "https://old2.example/",
    official: true,
  });
  fx.eventLink(event, {
    kind: "instagram",
    url: "https://instagram.com/example",
    official: true,
  });
  fx.occurrenceLink(edition, {
    kind: "ticketing",
    url: "https://tickets.example/",
    official: true,
  });
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.links.website = "https://new.example/";
  const prepared = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  applyCatalogItem(client, prepared.operations);
  const saved = readResearchCatalog(client)[0];
  expect(
    saved.links
      .filter((link) => link.kind === "official_site")
      .map((link) => link.url),
  ).toEqual(["https://new.example/"]);
  expect(saved.links.filter((link) => link.kind === "instagram")).toHaveLength(
    1,
  );
  expect(
    saved.editions[0].links.filter((link) => link.kind === "ticketing"),
  ).toHaveLength(1);
  proposed.data!.links.website = "https://NEW.example:443/#fragment";
  const repeat = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "check", eventId: event.id },
    [],
  );
  expect(repeat.operations.filter((op) => op.kind === "replaceLinks")).toEqual(
    [],
  );
});

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
    const prepared = prepareResearch(proposed, [], input, []);
    const op = prepared.operations.find(
      (item) => item.kind === "replacePriceBlock",
    );
    expect(op).toMatchObject({
      basePrice: { minMinor: expected, maxMinor: expected },
      priceDetails: [{ amount }],
    });
  }
});

test("creation needs identity reason; existing refresh does not", () => {
  const proposed = candidate();
  delete proposed.data!.reason;
  expect(prepareResearch(proposed, [], input, []).errors[0].code).toBe(
    "invalid_candidate",
  );
  const { client, eventId } = create();
  proposed.data!.eventId = eventId;
  expect(
    prepareResearch(
      proposed,
      readResearchCatalog(client),
      { ...input, mode: "refresh", eventId },
      [],
    ).errors,
  ).toEqual([]);
});

test("classification removals win over additions", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.occurrence(event, { occurrenceKey: "2027" });
  const old = fx.term({ slug: "old" });
  const newTerm = fx.term({ slug: "new" });
  fx.assignTerm(edition, old);
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.editions[0].classification = {
    add: { value: [newTerm.id, old.id], reason: "New classification" },
    remove: { value: [old.id], reason: "Old classification obsolete" },
  };
  const prepared = prepareResearch(
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
    "New classification",
    "Old classification obsolete",
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
  fx.occurrence(event, {
    occurrenceKey: "2027",
    venueName: "Old Field",
    locality: "Old City",
    timeZone: "Europe/Lisbon",
    priceDetails: [{ label: "Regular", amount: 20, currency: "EUR" }],
  });
  const proposed = candidate();
  proposed.data!.eventId = event.id;
  proposed.data!.editions[0].venueName = {
    value: "New Field",
    reason: "Organizer moved venues",
  };
  const prepared = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "refresh", eventId: event.id },
    [],
  );
  applyCatalogItem(client, prepared.operations);
  const saved = readResearchCatalog(client)[0].editions[0];
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
  const prepared = prepareResearch(proposed, [], input, []);
  const links = prepared.operations.filter((op) => op.kind === "replaceLinks");
  expect(links).toHaveLength(2);
  expect(links.map((op) => op.owner.id)).toEqual(["$occ_0", "$occ_1"]);
});

test("writer rejection rolls back a supplied link replacement", () => {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.occurrence(event, {
    occurrenceKey: "2027",
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
  const prepared = prepareResearch(
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
  const prepared = prepareResearch(
    proposed,
    readResearchCatalog(client),
    { ...input, mode: "check", eventId },
    [],
  );
  const op = prepared.operations.find(
    (item) => item.kind === "updateOccurrence",
  )!;
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
