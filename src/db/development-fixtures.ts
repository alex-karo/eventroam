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
  "capacity_estimate",
  "publication_state",
  "terms",
];
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
    .prepare("SELECT id FROM events WHERE slug='fictional-field-days'")
    .get() as { id: string } | undefined;
  if (existing) return existing.id;
  const event = applyCatalogOperation(client, {
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
  return event.id;
}
