import { expect, test } from "vitest";
import {
  createTestEvent,
  createTestPublishedOccurrence,
  createTestPublishedEvent,
  publishTestEvent,
  testEvidence,
} from "../test/catalog";
import { testDatabase } from "../test/database";
import { applyCatalogOperation } from "./catalog";
import {
  publicEvent,
  publicOccurrenceById,
  resolvePublicPath,
  selectActive,
} from "./public-catalog";
import { discoveryCatalog } from "./discovery-catalog";
import { emptyFilters, filterSummaries, parseFilters } from "./discovery";
import { siteForHost, siteOrigins } from "./public-site";

function upcoming(client: Parameters<typeof discoveryCatalog>[0], now: Date) {
  const { summaries, genres } = discoveryCatalog(client);
  return filterSummaries(summaries, emptyFilters(), genres, now);
}

test("upcoming list and active selection use only current public editions", () => {
  const client = testDatabase().client;
  const { event: created } = createTestPublishedEvent(client, {
    occurrences: [
      {
        occurrenceKey: "2025",
        startsOn: "2025-07-01",
        endsOn: "2025-07-03",
        scheduleStatus: "scheduled",
      },
      {
        occurrenceKey: "2027",
        startsOn: "2027-07-01",
        endsOn: "2027-07-03",
        dateState: "provisional",
        scheduleStatus: "scheduled",
        locality: "Test Valley",
        latitude: null,
        longitude: null,
      },
      {
        occurrenceKey: "2026-cancelled",
        startsOn: "2026-07-01",
        endsOn: "2026-07-03",
        scheduleStatus: "cancelled",
      },
    ],
  });
  const id = created.id;
  const list = upcoming(client, new Date("2026-10-01T12:00:00Z"));
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({
    key: "2027",
    dateState: "provisional",
    latitude: null,
    longitude: null,
    locality: "Test Valley",
  });
  const event = publicEvent(client, id)!;
  expect(event.editions.map((o) => o.key)).toEqual([
    "2027",
    "2026-cancelled",
    "2025",
  ]);
  expect(selectActive(event.editions, "2026-10-01")?.key).toBe("2027");
  expect(selectActive(event.editions, "2028-01-01")).toBeNull();
  expect(JSON.stringify(event)).not.toMatch(
    /sourceId|operationKey|catalog_changes|retrievedAt|test-source-official/,
  );
});

test("on-demand discovery details obey publication and schedule gates", () => {
  const client = testDatabase().client;
  const { occurrences } = createTestPublishedEvent(client, {
    occurrences: [
      { occurrenceKey: "2027", scheduleStatus: "scheduled" },
      {
        occurrenceKey: "2025",
        startsOn: "2025-07-01",
        scheduleStatus: "scheduled",
      },
      {
        occurrenceKey: "2026-cancelled",
        startsOn: "2026-07-01",
        scheduleStatus: "cancelled",
      },
    ],
  });
  const [current, history, cancelled] = occurrences;
  expect(publicOccurrenceById(client, current.id)?.key).toBe("2027");
  expect(publicOccurrenceById(client, history.id)?.key).toBe("2025");
  expect(publicOccurrenceById(client, cancelled.id)).toBeNull();
  expect(publicOccurrenceById(client, "missing")).toBeNull();
});

test("published history and postponement retain pages but leave upcoming list", () => {
  const client = testDatabase().client;
  const { occurrences } = createTestPublishedEvent(client, {
    event: { slug: "test-field-days" },
    occurrences: [
      {
        occurrenceKey: "2025",
        startsOn: "2025-07-01",
        scheduleStatus: "scheduled",
      },
      {
        occurrenceKey: "2027",
        startsOn: "2027-07-01",
        scheduleStatus: "scheduled",
      },
      {
        occurrenceKey: "2026-cancelled",
        startsOn: "2026-07-01",
        scheduleStatus: "cancelled",
      },
    ],
  });
  const old = occurrences[1];
  applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "public:postpone",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { scheduleStatus: "postponed" },
    evidence: testEvidence(["schedule_status"]),
  });
  expect(upcoming(client, new Date("2026-10-01T12:00:00Z"))).toEqual([]);
  expect(
    resolvePublicPath(client, "/events/test-field-days/2027")?.edition?.status,
  ).toBe("postponed");
  expect(
    resolvePublicPath(client, "/events/test-field-days/2026-cancelled")?.edition
      ?.status,
  ).toBe("cancelled");
  expect(
    resolvePublicPath(client, "/events/test-field-days/2025")?.edition?.key,
  ).toBe("2025");
});

test("renamed addresses redirect by stored identity and hidden targets fail", () => {
  const client = testDatabase().client;
  const { event, occurrences } = createTestPublishedEvent(client, {
    event: { slug: "test-field-days" },
    occurrences: [{ occurrenceKey: "2027" }],
  });
  const id = event.id;
  applyCatalogOperation(client, {
    kind: "updateEvent",
    operationKey: "public:rename",
    actor: "owner",
    id,
    expectedVersion: event.version,
    data: { slug: "test-new-name" },
    evidence: testEvidence(["slug"]),
  });
  expect(resolvePublicPath(client, "/events/test-field-days")?.redirect).toBe(
    true,
  );
  expect(
    resolvePublicPath(client, "/events/test-field-days/2027")?.redirect,
  ).toBe(true);
  expect(
    resolvePublicPath(client, "/events/test-new-name/2027")?.redirect,
  ).toBe(false);
  expect(resolvePublicPath(client, "/events/missing")).toBeNull();
  const edition = occurrences[0];
  applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "public:withdraw",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
  });
  expect(resolvePublicPath(client, "/events/test-field-days/2027")).toBeNull();
  expect(resolvePublicPath(client, "/events/test-new-name/2027")).toBeNull();
  expect(upcoming(client, new Date("2026-10-01T12:00:00Z"))).toEqual([]);
  client
    .prepare("UPDATE events SET publication_state='withdrawn' WHERE id=?")
    .run(id);
  expect(resolvePublicPath(client, "/events/test-field-days")).toBeNull();
  expect(publicEvent(client, id)).toBeNull();
});

test("scope hosts are allowlisted and canonical origins are configured", () => {
  const origins = siteOrigins({
    PUBLIC_APEX_ORIGIN: "https://eventroam.example",
    PUBLIC_FESTIVALS_ORIGIN: "https://festivals.eventroam.example",
  });
  expect(siteForHost("festivals.eventroam.example", origins)).toBe("festivals");
  expect(siteForHost("eventroam.example", origins)).toBe("apex");
  expect(siteForHost("unconfigured.example", origins)).toBeNull();
});

test("official links inherit by kind and private links and evidence stay outside public reads", () => {
  const client = testDatabase().client;
  const { event, occurrences } = createTestPublishedEvent(client, {
    event: { slug: "test-field-days" },
    occurrences: [{ occurrenceKey: "2027" }],
  });
  const id = event.id;
  const edition = occurrences[0];
  const now = "2026-10-01T12:00:00Z";
  const insert = client.prepare(
    "INSERT INTO external_links(id,event_id,occurrence_id,kind,url,label,official,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  insert.run(
    "parent-site",
    id,
    null,
    "official_site",
    "https://example.org/parent",
    null,
    1,
    now,
    now,
  );
  insert.run(
    "parent-social",
    id,
    null,
    "facebook",
    "https://example.org/parent-social",
    null,
    1,
    now,
    now,
  );
  insert.run(
    "edition-site",
    null,
    edition.id,
    "official_site",
    "https://example.org/edition",
    "Edition site",
    1,
    now,
    now,
  );
  insert.run(
    "private-social",
    null,
    edition.id,
    "instagram",
    "https://example.org/private",
    null,
    0,
    now,
    now,
  );
  const read = resolvePublicPath(
    client,
    "/events/test-field-days/2027",
  )!.edition!;
  expect(read.links).toEqual([
    {
      kind: "facebook",
      url: "https://example.org/parent-social",
      label: null,
    },
    {
      kind: "official_site",
      url: "https://example.org/edition",
      label: "Edition site",
    },
  ]);
  expect(JSON.stringify(read)).not.toContain("example.org/private");
});

test("a published Event with no published edition has no public route", () => {
  const client = testDatabase().client;
  const { event } = createTestPublishedEvent(client, {
    event: { slug: "test-field-days" },
    occurrences: [{ occurrenceKey: "2027" }],
  });
  const id = event.id;
  client
    .prepare(
      "UPDATE occurrences SET publication_state='withdrawn' WHERE event_id=?",
    )
    .run(id);
  expect(publicEvent(client, id)).toBeNull();
  expect(resolvePublicPath(client, "/events/test-field-days")).toBeNull();
});

test("complete compact discovery includes history and unlocated editions, excluding cancelled", () => {
  const client = testDatabase().client;
  createTestPublishedEvent(client, {
    occurrences: [
      {
        occurrenceKey: "2025",
        startsOn: "2025-07-01",
        endsOn: "2025-07-03",
        countryCode: "PT",
        scheduleStatus: "scheduled",
        latitude: null,
        longitude: null,
      },
      {
        occurrenceKey: "2027",
        startsOn: "2027-07-01",
        scheduleStatus: "scheduled",
        latitude: null,
        longitude: null,
      },
      {
        occurrenceKey: "2026-cancelled",
        startsOn: "2026-07-01",
        scheduleStatus: "cancelled",
      },
    ],
  });
  const mapped = createTestEvent(client, {
    slug: "test-river-sounds",
  });
  createTestPublishedOccurrence(client, mapped.id, {
    occurrenceKey: "2027",
    startsOn: "2027-08-19",
    endsOn: "2027-08-21",
    scheduleStatus: "scheduled",
    countryCode: "FR",
    locality: "Lyon",
    latitude: 45.764,
    longitude: 4.8357,
    coordinatePrecision: "locality",
  });
  publishTestEvent(client, mapped);
  const catalog = discoveryCatalog(client);
  expect(catalog.summaries.map((s) => s.key).sort()).toEqual([
    "2025",
    "2027",
    "2027",
  ]);
  expect(
    catalog.summaries.filter(
      (s) => s.latitude === null && s.longitude === null,
    ),
  ).toHaveLength(2);
  expect(
    catalog.summaries.filter(
      (s) => s.latitude !== null && s.longitude !== null,
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(catalog)).not.toMatch(
    /price|sourceId|retrievedAt|evidence|venueAddress|summary/,
  );
  const filters = parseFilters(
    new URLSearchParams(
      "from=2025-07-03&to=2025-07-03&country=PT&durationMin=3",
    ),
    catalog.genres,
  );
  const serverResults = filterSummaries(
    catalog.summaries,
    filters,
    catalog.genres,
    new Date("2026-10-01T12:00:00Z"),
  );
  const browserResults = filterSummaries(
    JSON.parse(JSON.stringify(catalog.summaries)),
    filters,
    JSON.parse(JSON.stringify(catalog.genres)),
    new Date("2026-10-01T12:00:00Z"),
  );
  expect(serverResults.map((s) => s.key)).toEqual(["2025"]);
  expect(browserResults).toEqual(serverResults);
});
