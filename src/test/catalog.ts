import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  applyCatalogOperation,
  type CatalogOperation,
} from "../application/catalog";
import { sources, taxonomyTerms } from "../db/schema";

export const testSourceId = "test-source-official";
export const testSourceUrl = "https://example.org/test-festival";
const timestamp = "2026-10-01T12:00:00Z";
const festivalTermIds = ["test-festival", "test-outdoor", "test-music"];
const publicationFields = [
  "publication_state",
  "canonical_name",
  "starts_on",
  "ends_on",
  "date_state",
  "country_code",
  "terms",
];
const defaultEvidenceFields = [
  ...publicationFields,
  "slug",
  "occurrence_year",
  "schedule_status",
  "locality",
  "capacity_estimate",
  "price_kind",
  "price_currency",
  "price_min_minor",
  "price_max_minor",
  "price_coverage",
  "price_qualification",
];

export function testEvidence(fieldPaths = defaultEvidenceFields) {
  return [
    {
      sourceId: testSourceId,
      inspectedUrl: testSourceUrl,
      retrievedAt: timestamp,
      authority: "official" as const,
      fieldPaths,
      excerpt: "Fictional test record",
    },
  ];
}

export function prepareTestSource(client: Database.Database) {
  drizzle(client)
    .insert(sources)
    .values({
      id: testSourceId,
      canonicalUrl: testSourceUrl,
      kind: "website",
      authority: "official",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing()
    .run();
}

export function prepareFestivalTerms(client: Database.Database) {
  const db = drizzle(client);
  for (const [id, facet, slug, name] of [
    ["test-festival", "event_type", "festival", "Festival"],
    ["test-outdoor", "format", "outdoor", "Outdoor"],
    ["test-music", "topic", "music", "Music"],
  ] as const)
    db.insert(taxonomyTerms)
      .values({ id, facet, slug, name })
      .onConflictDoNothing()
      .run();
  return [...festivalTermIds];
}

export function createTestEvent(
  client: Database.Database,
  data: { slug?: string; canonicalName?: string } = {},
) {
  prepareTestSource(client);
  const slug = data.slug ?? "test-field-days";
  const canonicalName = data.canonicalName ?? "Test Field Days";
  return applyCatalogOperation(client, {
    kind: "createEvent",
    operationKey: `test:${slug}:create`,
    actor: "test",
    data: { slug, canonicalName },
    evidence: testEvidence(["slug", "canonical_name"]),
  });
}

type OccurrenceData = Extract<
  CatalogOperation,
  { kind: "createOccurrence" }
>["data"];

type OccurrenceOverrides = Partial<OccurrenceData>;

function occurrenceData(overrides: OccurrenceOverrides): OccurrenceData {
  const startsOn =
    overrides.startsOn === undefined ? "2027-07-01" : overrides.startsOn;
  const occurrenceYear =
    overrides.occurrenceYear === undefined
      ? startsOn
        ? Number(startsOn.slice(0, 4))
        : null
      : overrides.occurrenceYear;
  return {
    occurrenceKey: overrides.occurrenceKey ?? String(occurrenceYear ?? 2027),
    occurrenceYear,
    startsOn,
    endsOn: overrides.endsOn === undefined ? startsOn : overrides.endsOn,
    dateState: startsOn ? "confirmed" : "unknown",
    scheduleStatus: startsOn ? "scheduled" : "announced",
    countryCode: "PT",
    locality: "Test Valley",
    ...overrides,
  };
}

export function createTestPublishedOccurrence(
  client: Database.Database,
  eventId: string,
  overrides: OccurrenceOverrides = {},
) {
  prepareTestSource(client);
  const data = occurrenceData(overrides);
  const fields = Object.keys(data).flatMap((key) =>
    key === "price"
      ? [
          "price_kind",
          "price_currency",
          "price_min_minor",
          "price_max_minor",
          "price_coverage",
          "price_qualification",
        ]
      : [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)],
  );
  const created = applyCatalogOperation(client, {
    kind: "createOccurrence",
    operationKey: `test:${eventId}:${data.occurrenceKey}:create`,
    actor: "test",
    eventId,
    data,
    evidence: testEvidence(fields),
  });
  const classified = applyCatalogOperation(client, {
    kind: "replaceTerms",
    operationKey: `test:${eventId}:${data.occurrenceKey}:terms`,
    actor: "test",
    id: created.id,
    expectedVersion: created.version,
    termIds: prepareFestivalTerms(client),
    evidence: testEvidence(["terms"]),
  });
  return applyCatalogOperation(client, {
    kind: "publishOccurrence",
    operationKey: `test:${eventId}:${data.occurrenceKey}:publish`,
    actor: "test",
    id: classified.id,
    expectedVersion: classified.version,
    evidence: testEvidence([
      ...publicationFields,
      data.venueName
        ? "venue_name"
        : data.locality
          ? "locality"
          : "administrative_area",
    ]),
  });
}

export function publishTestEvent(
  client: Database.Database,
  event: { id: string; version: number },
) {
  return applyCatalogOperation(client, {
    kind: "publishEvent",
    operationKey: `test:${event.id}:publish`,
    actor: "test",
    id: event.id,
    expectedVersion: event.version,
    evidence: testEvidence(publicationFields),
  });
}

export function createTestPublishedEvent(
  client: Database.Database,
  data: {
    event?: { slug?: string; canonicalName?: string };
    occurrences: OccurrenceOverrides[];
  },
) {
  const created = createTestEvent(client, data.event);
  const occurrences = data.occurrences.map((occurrence) =>
    createTestPublishedOccurrence(client, created.id, occurrence),
  );
  const event = publishTestEvent(client, created);
  return { event, occurrences };
}
