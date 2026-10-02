import { expect, test, vi } from "vitest";
import {
  createTestEvent,
  createTestPublishedOccurrence,
  createTestPublishedEvent,
  publishTestEvent,
} from "../test/catalog";
import { testDatabase } from "../test/database";
import {
  publicEditions,
  publicEvent,
  publicOccurrenceById,
  resolvePublicPath,
  selectActive,
} from "./public-catalog";
import {
  discoveryCatalog,
  discoveryGenres,
  publicSummaries,
} from "./discovery-catalog";
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
  client
    .prepare("UPDATE occurrences SET schedule_status='postponed' WHERE id=?")
    .run(old.id);
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
  client.prepare("UPDATE events SET slug='test-new-name' WHERE id=?").run(id);
  const alias = client.prepare(
    "INSERT INTO url_aliases(scope,path,event_id,occurrence_id,created_at) VALUES ('festivals',?,?,?,?)",
  );
  alias.run("/events/test-new-name", id, null, "2026-10-01T12:00:00Z");
  alias.run(
    "/events/test-new-name/2027",
    id,
    occurrences[0].id,
    "2026-10-01T12:00:00Z",
  );
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
  client
    .prepare("UPDATE occurrences SET publication_state='withdrawn' WHERE id=?")
    .run(edition.id);
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
  for (const [key, eventId, occurrenceId, kind, path, label, official] of [
    ["parent-site", id, null, "official_site", "parent", null, 1],
    ["parent-social", id, null, "facebook", "parent-social", null, 1],
    [
      "edition-site",
      null,
      edition.id,
      "official_site",
      "edition",
      "Edition site",
      1,
    ],
    ["private-social", null, edition.id, "instagram", "private", null, 0],
  ])
    insert.run(
      key,
      eventId,
      occurrenceId,
      kind,
      `https://example.org/${path}`,
      label,
      official,
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

test("public summary and detail reads batch classification and link lookup across editions", () => {
  const client = testDatabase().client;
  const { event, occurrences } = createTestPublishedEvent(client, {
    occurrences: [
      { occurrenceKey: "2027-a" },
      { occurrenceKey: "2027-b" },
      { occurrenceKey: "2027-c" },
    ],
  });
  client.exec(`
    INSERT INTO taxonomy_terms (id,facet,slug,name,parent_id) VALUES
    ('genre-parent','genre','electronic','Electronic',NULL),
    ('genre-child','genre','psytrance','Psytrance','genre-parent'),
    ('genre-metal','genre','metal','Metal',NULL);
  `);
  const assign = client.prepare(
    "INSERT INTO occurrence_terms (occurrence_id,term_id) VALUES (?,?)",
  );
  assign.run(occurrences[0].id, "genre-child");
  assign.run(occurrences[0].id, "genre-metal");
  assign.run(occurrences[1].id, "genre-parent");
  const insertLink = client.prepare(
    "INSERT INTO external_links (id,event_id,occurrence_id,kind,url,official,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  const now = "2026-10-01T12:00:00Z";
  for (const [key, eventId, occurrenceId, path, official] of [
    ["parent-site", event.id, null, "event", 1],
    ["edition-site", null, occurrences[0].id, "edition", 1],
    ["private-site", null, occurrences[1].id, "private", 0],
  ])
    insertLink.run(
      key,
      eventId,
      occurrenceId,
      "official_site",
      `https://example.org/${path}`,
      official,
      now,
      now,
    );
  const queries: string[] = [];
  const originalPrepare = client.prepare.bind(client);
  const prepare = vi
    .spyOn(client, "prepare")
    .mockImplementation((sql: string) => {
      const statement = originalPrepare(sql);
      const all = statement.all.bind(statement);
      const get = statement.get.bind(statement);
      statement.all = (...params) => {
        queries.push(sql);
        return all(...params);
      };
      statement.get = (...params) => {
        queries.push(sql);
        return get(...params);
      };
      return statement;
    });
  try {
    expect(discoveryGenres(client)).toEqual([
      { slug: "electronic", name: "Electronic", parentSlug: null },
      { slug: "metal", name: "Metal", parentSlug: null },
      { slug: "psytrance", name: "Psytrance", parentSlug: "electronic" },
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain("occurrences");
    queries.length = 0;
    const summaries = publicSummaries(client);
    expect(queries).toHaveLength(2);
    expect(summaries.find((s) => s.id === occurrences[0].id)?.genres).toEqual([
      "metal",
      "psytrance",
    ]);
    expect(summaries.find((s) => s.id === occurrences[1].id)?.genres).toEqual([
      "electronic",
    ]);
    expect(summaries.find((s) => s.id === occurrences[2].id)?.genres).toEqual(
      [],
    );
    queries.length = 0;
    const editions = publicEditions(client, event.id);
    expect(queries).toHaveLength(3);
    expect(
      editions
        .find((s) => s.id === occurrences[0].id)
        ?.terms.filter((t) => t.facet === "genre"),
    ).toEqual([
      { facet: "genre", name: "Metal" },
      { facet: "genre", name: "Psytrance" },
    ]);
    expect(editions.find((s) => s.id === occurrences[0].id)?.links).toEqual([
      {
        kind: "official_site",
        url: "https://example.org/edition",
        label: null,
      },
    ]);
    expect(editions.find((s) => s.id === occurrences[1].id)?.links).toEqual([]);
    expect(editions.find((s) => s.id === occurrences[2].id)?.links).toEqual([
      { kind: "official_site", url: "https://example.org/event", label: null },
    ]);
    createTestPublishedOccurrence(client, event.id, {
      occurrenceKey: "2027-d",
    });
    queries.length = 0;
    expect(publicSummaries(client)).toHaveLength(4);
    expect(queries).toHaveLength(2);
    queries.length = 0;
    expect(publicEditions(client, event.id)).toHaveLength(4);
    expect(queries).toHaveLength(3);
  } finally {
    prepare.mockRestore();
  }
});

test("discovery hides draft and withdrawn parents and editions", () => {
  const client = testDatabase().client;
  const { event, occurrences } = createTestPublishedEvent(client, {
    occurrences: [
      { occurrenceKey: "visible" },
      { occurrenceKey: "draft" },
      { occurrenceKey: "withdrawn" },
    ],
  });
  client
    .prepare("UPDATE occurrences SET publication_state='draft' WHERE id=?")
    .run(occurrences[1].id);
  client
    .prepare("UPDATE occurrences SET publication_state='withdrawn' WHERE id=?")
    .run(occurrences[2].id);
  expect(
    upcoming(client, new Date("2026-10-01T12:00:00Z")).map((s) => s.id),
  ).toEqual([occurrences[0].id]);
  for (const state of ["draft", "withdrawn"]) {
    client
      .prepare("UPDATE events SET publication_state=? WHERE id=?")
      .run(state, event.id);
    expect(discoveryCatalog(client).summaries).toEqual([]);
    expect(upcoming(client, new Date("2026-10-01T12:00:00Z"))).toEqual([]);
    expect(publicOccurrenceById(client, occurrences[0].id)).toBeNull();
  }
});
