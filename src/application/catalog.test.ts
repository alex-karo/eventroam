import { expect, test } from "vitest";
import {
  createTestEvent,
  createTestPublishedOccurrence,
  createTestPublishedEvent,
  prepareFestivalTerms,
  publishTestEvent,
} from "../test/catalog";
import { testDatabase } from "../test/database";
import { applyCatalogOperation, type CatalogOperation } from "./catalog";

const count = (
  client: ReturnType<typeof testDatabase>["client"],
  table: string,
) =>
  (client.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n;

test("postponement preserves previous dates and only changes its edition", () => {
  const client = testDatabase().client;
  const event = createTestEvent(client);
  const edition = createTestPublishedOccurrence(client, event.id, {
    occurrenceKey: "2027",
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  const other = createTestPublishedOccurrence(client, event.id, {
    occurrenceKey: "2025",
    startsOn: "2025-07-01",
  });
  const result = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:postpone",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: { scheduleStatus: "postponed" },
  });
  expect(result.version).toBe(edition.version + 1);
  expect(
    client
      .prepare(
        "SELECT starts_on,ends_on,schedule_status FROM occurrences WHERE id=?",
      )
      .get(edition.id),
  ).toMatchObject({
    starts_on: "2027-07-01",
    ends_on: "2027-07-03",
    schedule_status: "postponed",
  });
  expect(
    (
      client
        .prepare("SELECT version FROM occurrences WHERE id=?")
        .get(other.id) as { version: number }
    ).version,
  ).toBe(other.version);
});

test("invalid changes roll back, stale writes fail, replay is idempotent and payload mismatch fails", () => {
  const client = testDatabase().client;
  const event = createTestEvent(client);
  const old = createTestPublishedOccurrence(client, event.id, {
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:invalid",
      actor: "owner",
      id: old.id,
      expectedVersion: old.version,
      data: { startsOn: null },
    }),
  ).toThrow();
  const op = {
    kind: "updateOccurrence" as const,
    operationKey: "test:valid",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { capacityEstimate: 1200 },
  };
  const applied = applyCatalogOperation(client, op);
  expect(applied.changed).toBe(true);
  expect(applyCatalogOperation(client, op)).toEqual(applied);
  expect(() =>
    applyCatalogOperation(client, {
      ...op,
      evidence: [],
    } as CatalogOperation),
  ).toThrow();
  expect(() =>
    applyCatalogOperation(client, { ...op, data: { capacityEstimate: 1300 } }),
  ).toThrow(/different payload/);
  expect(() =>
    applyCatalogOperation(client, { ...op, operationKey: "test:stale" }),
  ).toThrow(/Stale/);
});

test("publication gates dates, area and scope; withdrawal retains URL reservation", () => {
  const client = testDatabase().client;
  const event = createTestEvent(client, { slug: "test-field-days" });
  prepareFestivalTerms(client);
  const draft = applyCatalogOperation(client, {
    kind: "createOccurrence",
    operationKey: "test:draft",
    actor: "owner",
    eventId: event.id,
    data: {
      occurrenceKey: "2028",
      dateState: "unknown",
      countryCode: "PT",
      locality: "Example Valley",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-undated",
      actor: "owner",
      id: draft.id,
      expectedVersion: draft.version,
    }),
  ).toThrow(/Publication needs/);
  let updated = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:dates",
    actor: "owner",
    id: draft.id,
    expectedVersion: draft.version,
    data: {
      occurrenceYear: 2028,
      startsOn: "2028-07-01",
      endsOn: "2028-07-03",
      dateState: "provisional",
    },
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-no-terms",
      actor: "owner",
      id: draft.id,
      expectedVersion: updated.version,
    }),
  ).toThrow(/format/);
  updated = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: "test:terms",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
    termIds: ["test-festival", "test-outdoor", "test-music"],
  });
  const published = applyCatalogOperation(client, {
    kind: "publishOccurrence",
    operationKey: "test:publish",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
  });
  expect(published.changed).toBe(true);
  publishTestEvent(client, event);
  const withdrawn = applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "test:withdraw",
    actor: "owner",
    id: draft.id,
    expectedVersion: published.version,
  });
  expect(withdrawn.changed).toBe(true);
  expect(
    client
      .prepare("SELECT path FROM url_aliases WHERE occurrence_id=?")
      .get(draft.id),
  ).toMatchObject({ path: "/events/test-field-days/2028" });
});

test("published event rename reserves old and new paths, including editions", () => {
  const client = testDatabase().client;
  const { event } = createTestPublishedEvent(client, {
    event: { slug: "test-field-days" },
    occurrences: [{ occurrenceKey: "2027" }],
  });
  const id = event.id;
  const aliasesBefore = count(client, "url_aliases");
  applyCatalogOperation(client, {
    kind: "updateEvent",
    operationKey: "test:rename",
    actor: "owner",
    id,
    expectedVersion: event.version,
    data: { slug: "fictional-new-name" },
  });
  expect(count(client, "url_aliases")).toBe(aliasesBefore + 2);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "test:reuse",
      actor: "owner",
      data: { slug: "test-field-days", canonicalName: "Other" },
    }),
  ).toThrow(/reserved/);
});

test("typed price, capacity, coordinates, and area rules reject unsupported values", () => {
  const client = testDatabase().client;
  const event = createTestEvent(client);
  const edition = createTestPublishedOccurrence(client, event.id, {
    countryCode: "PT",
    latitude: null,
    longitude: null,
    coordinatePrecision: "unknown",
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-price",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: {
        price: {
          kind: "range",
          currency: "EUR",
          minMinor: 5000,
          maxMinor: 4000,
          coverage: "full_programme",
        },
      },
    }),
  ).toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-coordinates",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { latitude: 0, coordinatePrecision: "approximate" },
    }),
  ).toThrow(/Coordinate pair/);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:bad-area",
      actor: "owner",
      id: edition.id,
      expectedVersion: edition.version,
      data: { countryCode: null },
    }),
  ).toThrow(/country/);
  const changed = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:price",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: {
      capacityEstimate: 1200,
      price: {
        kind: "from",
        currency: "EUR",
        minMinor: 6500,
        maxMinor: 6500,
        coverage: "full_programme",
        qualification: "Early tier; fees unknown",
      },
    },
  });
  expect(changed.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT price_currency,price_min_minor FROM occurrences WHERE id=?",
      )
      .get(edition.id),
  ).toMatchObject({ price_currency: "EUR", price_min_minor: 6500 });
  expect(() =>
    client
      .prepare("UPDATE occurrences SET latitude=1 WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare("UPDATE occurrences SET price_coverage=NULL WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind='free',price_currency=NULL,price_min_minor=NULL,price_max_minor=0,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind='free',price_currency=NULL,price_min_minor=0,price_max_minor=0,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).not.toThrow();
  expect(() =>
    client
      .prepare("UPDATE occurrences SET price_kind=NULL WHERE id=?")
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind=NULL,price_currency='EUR',price_min_minor=100,price_max_minor=100,price_coverage='full_programme' WHERE id=?",
      )
      .run(edition.id),
  ).toThrow();
  expect(() =>
    client
      .prepare(
        "UPDATE occurrences SET price_kind=NULL,price_currency=NULL,price_min_minor=NULL,price_max_minor=NULL,price_coverage=NULL,price_qualification=NULL WHERE id=?",
      )
      .run(edition.id),
  ).not.toThrow();
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:unassigned-country",
      actor: "owner",
      id: edition.id,
      expectedVersion: changed.version,
      data: { countryCode: "ZZ" },
    }),
  ).toThrow(/ISO 3166-1/);
});

test("identical link replacement is a no-op and an added link preserves existing identity", () => {
  const client = testDatabase().client;
  const event = createTestEvent(client);
  const id = event.id;
  const initialVersion = event.version;
  const first = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-first",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: initialVersion,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
    ],
  });
  const existing = client
    .prepare("SELECT id,created_at FROM external_links WHERE event_id=?")
    .get(id) as { id: string; created_at: string };
  const repeated = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-repeat",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: first.version,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
    ],
  });
  expect(repeated).toEqual({ id, version: first.version, changed: false });
  const added = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-add",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: repeated.version,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
      {
        kind: "instagram",
        url: "https://instagram.com/example",
        official: true,
      },
    ],
  });
  expect(added.changed).toBe(true);
  expect(
    client
      .prepare(
        "SELECT id,created_at FROM external_links WHERE kind='official_site' AND event_id=?",
      )
      .get(id),
  ).toEqual(existing);
});
