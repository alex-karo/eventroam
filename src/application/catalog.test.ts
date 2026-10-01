import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, test } from "vitest";
import { openDatabase } from "../db/connection";
import { seedDevelopmentFixtures } from "../db/development-fixtures";
import { applyCatalogOperation } from "./catalog";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "eventroam-catalog-"));
  const { client, db } = openDatabase(join(dir, "catalog.sqlite"));
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  cleanup.push(() => {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return client;
}
const facts = [
  "slug",
  "canonical_name",
  "starts_on",
  "ends_on",
  "date_state",
  "country_code",
  "locality",
  "terms",
  "publication_state",
  "schedule_status",
  "capacity_estimate",
  "price_kind",
  "price_currency",
  "price_min_minor",
  "price_max_minor",
  "price_coverage",
];
const ev = (fields = facts) => [
  {
    sourceId: "dev-source-official",
    inspectedUrl: "https://example.org/fictional-festival",
    retrievedAt: "2026-10-01T12:00:00Z",
    authority: "official" as const,
    fieldPaths: fields,
    excerpt: "Fictional development evidence",
  },
];
const count = (client: ReturnType<typeof setup>, table: string) =>
  (client.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n;

test("fixtures are repeatable and keep historical, tentative and cancelled editions separate", () => {
  const client = setup();
  const id = seedDevelopmentFixtures(client);
  expect(seedDevelopmentFixtures(client)).toBe(id);
  expect(count(client, "events")).toBe(1);
  expect(count(client, "occurrences")).toBe(3);
  const rows = client
    .prepare(
      "SELECT occurrence_key,date_state,schedule_status,latitude,longitude,publication_state FROM occurrences ORDER BY occurrence_key",
    )
    .all() as {
    occurrence_key: string;
    date_state: string;
    schedule_status: string;
    latitude: number | null;
    longitude: number | null;
    publication_state: string;
  }[];
  expect(rows.find((r) => r.occurrence_key === "2025")?.publication_state).toBe(
    "published",
  );
  expect(rows.find((r) => r.occurrence_key === "2027")?.date_state).toBe(
    "provisional",
  );
  expect(
    rows.find((r) => r.occurrence_key === "2026-cancelled")?.schedule_status,
  ).toBe("cancelled");
  expect(rows.every((r) => r.latitude === null && r.longitude === null)).toBe(
    true,
  );
  expect(count(client, "url_aliases")).toBe(4);
});

test("postponement preserves previous dates and only changes its edition", () => {
  const client = setup();
  seedDevelopmentFixtures(client);
  const edition = client
    .prepare(
      "SELECT id,version,starts_on,ends_on FROM occurrences WHERE occurrence_key='2027'",
    )
    .get() as {
    id: string;
    version: number;
    starts_on: string;
    ends_on: string;
  };
  const other = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2025'")
    .get() as { id: string; version: number };
  const result = applyCatalogOperation(client, {
    kind: "updateOccurrence",
    operationKey: "test:postpone",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
    data: { scheduleStatus: "postponed" },
    evidence: ev(["schedule_status"]),
  });
  expect(result.version).toBe(edition.version + 1);
  expect(
    client
      .prepare(
        "SELECT starts_on,ends_on,schedule_status FROM occurrences WHERE id=?",
      )
      .get(edition.id),
  ).toMatchObject({
    starts_on: edition.starts_on,
    ends_on: edition.ends_on,
    schedule_status: "postponed",
  });
  expect(
    (
      client
        .prepare("SELECT version FROM occurrences WHERE id=?")
        .get(other.id) as { version: number }
    ).version,
  ).toBe(other.version);
  expect(
    client
      .prepare(
        "SELECT changed_fields FROM catalog_changes WHERE operation_key='test:postpone'",
      )
      .get(),
  ).toMatchObject({
    changed_fields: expect.stringContaining("schedule_status"),
  });
});

test("invalid changes roll back, stale writes fail, replay is idempotent and payload mismatch fails", () => {
  const client = setup();
  seedDevelopmentFixtures(client);
  const old = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string; version: number };
  const before = count(client, "catalog_changes");
  expect(() =>
    applyCatalogOperation(client, {
      kind: "updateOccurrence",
      operationKey: "test:invalid",
      actor: "owner",
      id: old.id,
      expectedVersion: old.version,
      data: { startsOn: null },
      evidence: ev(["starts_on"]),
    }),
  ).toThrow();
  expect(count(client, "catalog_changes")).toBe(before);
  expect(count(client, "operation_receipts")).toBe(11);
  const op = {
    kind: "updateOccurrence" as const,
    operationKey: "test:valid",
    actor: "owner",
    id: old.id,
    expectedVersion: old.version,
    data: { capacityEstimate: 1200 },
    evidence: ev(["capacity_estimate"]),
  };
  const applied = applyCatalogOperation(client, op);
  expect(applied.changed).toBe(true);
  expect(applyCatalogOperation(client, op)).toEqual(applied);
  expect(count(client, "catalog_changes")).toBe(before + 1);
  expect(() =>
    applyCatalogOperation(client, { ...op, data: { capacityEstimate: 1300 } }),
  ).toThrow(/different payload/);
  expect(() =>
    applyCatalogOperation(client, { ...op, operationKey: "test:stale" }),
  ).toThrow(/Stale/);
});

test("publication gates evidence, dates, area and scope; withdrawal retains URL reservation", () => {
  const client = setup();
  seedDevelopmentFixtures(client);
  const event = client.prepare("SELECT id FROM events").get() as { id: string };
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
    evidence: ev(),
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-undated",
      actor: "owner",
      id: draft.id,
      expectedVersion: draft.version,
      evidence: ev(),
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
    evidence: ev(["occurrence_year", "starts_on", "ends_on", "date_state"]),
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-no-terms",
      actor: "owner",
      id: draft.id,
      expectedVersion: updated.version,
      evidence: ev(),
    }),
  ).toThrow(/format/);
  updated = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: "test:terms",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
    termIds: ["dev-festival", "dev-outdoor", "dev-music"],
    evidence: ev(["terms"]),
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:publish-no-evidence",
      actor: "owner",
      id: draft.id,
      expectedVersion: updated.version,
      evidence: [],
    }),
  ).toThrow(/Source evidence/);
  const published = applyCatalogOperation(client, {
    kind: "publishOccurrence",
    operationKey: "test:publish",
    actor: "owner",
    id: draft.id,
    expectedVersion: updated.version,
    evidence: ev(),
  });
  expect(published.changed).toBe(true);
  const withdrawn = applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "test:withdraw",
    actor: "owner",
    id: draft.id,
    expectedVersion: published.version,
    evidence: [],
  });
  expect(withdrawn.changed).toBe(true);
  expect(
    client
      .prepare("SELECT path FROM url_aliases WHERE occurrence_id=?")
      .get(draft.id),
  ).toMatchObject({ path: "/events/fictional-field-days/2028" });
});

test("published event rename reserves old and new paths, including editions", () => {
  const client = setup();
  const id = seedDevelopmentFixtures(client);
  const event = client
    .prepare("SELECT version FROM events WHERE id=?")
    .get(id) as { version: number };
  applyCatalogOperation(client, {
    kind: "updateEvent",
    operationKey: "test:rename",
    actor: "owner",
    id,
    expectedVersion: event.version,
    data: { slug: "fictional-new-name" },
    evidence: ev(["slug"]),
  });
  expect(count(client, "url_aliases")).toBe(8);
  expect(() =>
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "test:reuse",
      actor: "owner",
      data: { slug: "fictional-field-days", canonicalName: "Other" },
      evidence: ev(),
    }),
  ).toThrow(/reserved/);
});

test("typed price, capacity, coordinates, and area rules reject unsupported values", () => {
  const client = setup();
  seedDevelopmentFixtures(client);
  const edition = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string; version: number };
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
      evidence: ev(),
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
      evidence: ev(["latitude", "coordinate_precision"]),
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
      evidence: ev(["country_code"]),
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
    evidence: ev([
      "capacity_estimate",
      "price_kind",
      "price_currency",
      "price_min_minor",
      "price_max_minor",
      "price_coverage",
      "price_qualification",
    ]),
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
      evidence: ev(["country_code"]),
    }),
  ).toThrow(/ISO 3166-1/);
});

test("identical link replacement is a no-op and an added link preserves existing identity", () => {
  const client = setup();
  const id = seedDevelopmentFixtures(client);
  const initialVersion = (
    client.prepare("SELECT version FROM events WHERE id=?").get(id) as {
      version: number;
    }
  ).version;
  const first = applyCatalogOperation(client, {
    kind: "replaceLinks",
    operationKey: "test:links-first",
    actor: "owner",
    owner: { type: "event", id },
    expectedVersion: initialVersion,
    links: [
      { kind: "official_site", url: "https://example.org/", official: true },
    ],
    evidence: ev(["links"]),
  });
  const existing = client
    .prepare("SELECT id,created_at FROM external_links WHERE event_id=?")
    .get(id) as { id: string; created_at: string };
  const auditCount = count(client, "catalog_changes");
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
  expect(count(client, "catalog_changes")).toBe(auditCount);
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
    evidence: ev(["links"]),
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

test("factual writes and publication reject metadata-only evidence", () => {
  const client = setup();
  const id = seedDevelopmentFixtures(client);
  const metadataOnly = [
    {
      sourceId: "dev-source-official",
      inspectedUrl: "https://example.org/fictional-festival",
      retrievedAt: "2026-10-01T12:00:00Z",
      authority: "official" as const,
      fieldPaths: ["slug", "canonical_name", "publication_state"],
    },
  ];
  expect(() =>
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "test:metadata-create",
      actor: "owner",
      data: { slug: "metadata-only", canonicalName: "Metadata only" },
      evidence: metadataOnly,
    }),
  ).toThrow(/excerpt or snapshot/);
  const edition = client
    .prepare("SELECT id,version FROM occurrences WHERE occurrence_key='2027'")
    .get() as { id: string; version: number };
  const withdrawn = applyCatalogOperation(client, {
    kind: "withdrawOccurrence",
    operationKey: "test:withdraw-evidence",
    actor: "owner",
    id: edition.id,
    expectedVersion: edition.version,
  });
  expect(() =>
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: "test:metadata-publish",
      actor: "owner",
      id: edition.id,
      expectedVersion: withdrawn.version,
      evidence: metadataOnly,
    }),
  ).toThrow(/excerpt or snapshot/);
  expect(
    client
      .prepare("SELECT publication_state FROM occurrences WHERE id=?")
      .get(edition.id),
  ).toMatchObject({ publication_state: "withdrawn" });
  expect(
    (
      client.prepare("SELECT id FROM events WHERE id=?").get(id) as {
        id: string;
      }
    ).id,
  ).toBe(id);
});
