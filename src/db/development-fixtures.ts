import type Database from "better-sqlite3";
import { applyCatalogOperation } from "../application/catalog";

const sourceId = "dev-source-official";
const inspectedUrl = "https://example.org/fictional-festival";
const evidence = (fieldPaths: string[]) => [
  {
    sourceId,
    inspectedUrl,
    retrievedAt: "2026-10-01T12:00:00Z",
    authority: "official" as const,
    fieldPaths,
    excerpt: "Fictional development fixture, not a real event.",
  },
];
const allFacts = [
  "slug",
  "canonical_name",
  "occurrence_key",
  "occurrence_year",
  "starts_on",
  "ends_on",
  "date_state",
  "schedule_status",
  "country_code",
  "locality",
  "latitude",
  "longitude",
  "coordinate_precision",
  "capacity_estimate",
  "publication_state",
  "terms",
];
// Fictional events use city-center markers; their dates and links are placeholders.
const geographicExamples = [
  {
    slug: "fictional-atlantic-sounds",
    name: "Fictional Atlantic Sounds",
    countryCode: "PT",
    locality: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
    startsOn: "2027-06-10",
    endsOn: "2027-06-12",
  },
  {
    slug: "fictional-mediterranean-nights",
    name: "Fictional Mediterranean Nights",
    countryCode: "ES",
    locality: "Barcelona",
    latitude: 41.3874,
    longitude: 2.1686,
    startsOn: "2027-07-15",
    endsOn: "2027-07-17",
  },
  {
    slug: "fictional-rhone-sessions",
    name: "Fictional Rhône Sessions",
    countryCode: "FR",
    locality: "Lyon",
    latitude: 45.764,
    longitude: 4.8357,
    startsOn: "2027-08-19",
    endsOn: "2027-08-21",
  },
] as const;
export function seedDevelopmentFixtures(client: Database.Database) {
  const now = "2026-10-01T12:00:00.000Z";
  client
    .prepare(
      "INSERT OR IGNORE INTO sources (id,canonical_url,kind,authority,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    )
    .run(sourceId, inspectedUrl, "website", "official", now, now);
  for (const [id, facet, slug, name] of [
    ["dev-festival", "event_type", "festival", "Festival"],
    ["dev-outdoor", "format", "outdoor", "Outdoor"],
    ["dev-music", "topic", "music", "Music"],
  ])
    client
      .prepare(
        "INSERT OR IGNORE INTO taxonomy_terms (id,facet,slug,name) VALUES (?,?,?,?)",
      )
      .run(id, facet, slug, name);
  const existing = client
    .prepare("SELECT id,version FROM events WHERE slug='fictional-field-days'")
    .get() as { id: string; version: number } | undefined;
  const event =
    existing ??
    applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: "dev:event",
      actor: "fixture",
      data: {
        slug: "fictional-field-days",
        canonicalName: "Fictional Field Days",
      },
      evidence: evidence(allFacts),
    });
  function edition(
    key: string,
    year: number,
    start: string,
    end: string,
    status: "scheduled" | "cancelled" | "postponed",
    published = true,
  ) {
    let result = applyCatalogOperation(client, {
      kind: "createOccurrence",
      operationKey: `dev:${key}:create`,
      actor: "fixture",
      eventId: event.id,
      data: {
        occurrenceKey: key,
        occurrenceYear: year,
        startsOn: start,
        endsOn: end,
        dateState: year === 2027 ? "provisional" : "confirmed",
        scheduleStatus: status,
        countryCode: "PT",
        locality: "Example Valley",
      },
      evidence: evidence(allFacts),
    });
    result = applyCatalogOperation(client, {
      kind: "replaceTerms",
      operationKey: `dev:${key}:terms`,
      actor: "fixture",
      id: result.id,
      expectedVersion: result.version,
      termIds: ["dev-festival", "dev-outdoor", "dev-music"],
      evidence: evidence(["terms"]),
    });
    if (published)
      result = applyCatalogOperation(client, {
        kind: "publishOccurrence",
        operationKey: `dev:${key}:publish`,
        actor: "fixture",
        id: result.id,
        expectedVersion: result.version,
        evidence: evidence(allFacts),
      });
    return result;
  }
  if (!existing) {
    edition("2025", 2025, "2025-07-01", "2025-07-03", "scheduled");
    edition("2027", 2027, "2027-07-01", "2027-07-03", "scheduled");
    edition("2026-cancelled", 2026, "2026-07-01", "2026-07-03", "cancelled");
    applyCatalogOperation(client, {
      kind: "publishEvent",
      operationKey: "dev:event:publish",
      actor: "fixture",
      id: event.id,
      expectedVersion: event.version,
      evidence: evidence(allFacts),
    });
  }
  for (const example of geographicExamples) {
    if (client.prepare("SELECT id FROM events WHERE slug=?").get(example.slug))
      continue;
    const newEvent = applyCatalogOperation(client, {
      kind: "createEvent",
      operationKey: `dev:${example.slug}:event`,
      actor: "fixture",
      data: { slug: example.slug, canonicalName: example.name },
      evidence: evidence(allFacts),
    });
    let occurrence = applyCatalogOperation(client, {
      kind: "createOccurrence",
      operationKey: `dev:${example.slug}:2027:create`,
      actor: "fixture",
      eventId: newEvent.id,
      data: {
        occurrenceKey: "2027",
        occurrenceYear: 2027,
        startsOn: example.startsOn,
        endsOn: example.endsOn,
        dateState: "provisional",
        scheduleStatus: "scheduled",
        countryCode: example.countryCode,
        locality: example.locality,
        latitude: example.latitude,
        longitude: example.longitude,
        coordinatePrecision: "locality",
      },
      evidence: evidence(allFacts),
    });
    occurrence = applyCatalogOperation(client, {
      kind: "replaceTerms",
      operationKey: `dev:${example.slug}:2027:terms`,
      actor: "fixture",
      id: occurrence.id,
      expectedVersion: occurrence.version,
      termIds: ["dev-festival", "dev-outdoor", "dev-music"],
      evidence: evidence(["terms"]),
    });
    applyCatalogOperation(client, {
      kind: "publishOccurrence",
      operationKey: `dev:${example.slug}:2027:publish`,
      actor: "fixture",
      id: occurrence.id,
      expectedVersion: occurrence.version,
      evidence: evidence(allFacts),
    });
    const linked = applyCatalogOperation(client, {
      kind: "replaceLinks",
      operationKey: `dev:${example.slug}:links`,
      actor: "fixture",
      owner: { type: "event", id: newEvent.id },
      expectedVersion: newEvent.version,
      links: [
        {
          kind: "official_site",
          url: `https://example.org/${example.slug}`,
          label: "Fictional festival website",
          official: true,
          sourceId,
        },
      ],
      evidence: evidence(["links"]),
    });
    applyCatalogOperation(client, {
      kind: "publishEvent",
      operationKey: `dev:${example.slug}:publish`,
      actor: "fixture",
      id: newEvent.id,
      expectedVersion: linked.version,
      evidence: evidence(allFacts),
    });
  }
  return event.id;
}
