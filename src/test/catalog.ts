import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  events,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
  urlAliases,
} from "../db/schema";

const timestamp = "2026-10-01T12:00:00Z";
const festivalTermIds = ["test-festival", "test-outdoor", "test-music"];

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
  const slug = data.slug ?? "test-field-days";
  const canonicalName = data.canonicalName ?? "Test Field Days";
  const id = randomUUID();
  drizzle(client)
    .insert(events)
    .values({
      id,
      slug,
      canonicalName,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();
  return { id, version: 1 };
}

type OccurrenceOverrides = Partial<
  Omit<
    typeof occurrences.$inferInsert,
    | "id"
    | "eventId"
    | "publicationState"
    | "version"
    | "createdAt"
    | "updatedAt"
  >
>;

function occurrenceData(overrides: OccurrenceOverrides) {
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
    dateState: startsOn ? ("confirmed" as const) : ("unknown" as const),
    scheduleStatus: startsOn ? ("scheduled" as const) : ("announced" as const),
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
  const data = occurrenceData(overrides);
  const id = randomUUID();
  const termIds = prepareFestivalTerms(client);
  drizzle(client).transaction((db) => {
    db.insert(occurrences)
      .values({
        id,
        eventId,
        ...data,
        publicationState: "published",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    for (const termId of termIds)
      db.insert(occurrenceTerms).values({ occurrenceId: id, termId }).run();
    const parent = db
      .select({ slug: events.slug, homeScope: events.homeScope })
      .from(events)
      .where(eq(events.id, eventId))
      .get();
    if (parent?.homeScope)
      db.insert(urlAliases)
        .values({
          scope: parent.homeScope,
          path: `/events/${parent.slug}/${data.occurrenceKey}`,
          eventId,
          occurrenceId: id,
          createdAt: timestamp,
        })
        .run();
  });
  return { id, version: 1 };
}

export function publishTestEvent(
  client: Database.Database,
  event: { id: string; version: number },
) {
  drizzle(client).transaction((db) => {
    db.update(events)
      .set({ publicationState: "published", homeScope: "festivals" })
      .where(eq(events.id, event.id))
      .run();
    const parent = db
      .select({ slug: events.slug })
      .from(events)
      .where(eq(events.id, event.id))
      .get()!;
    db.insert(urlAliases)
      .values({
        scope: "festivals",
        path: `/events/${parent.slug}`,
        eventId: event.id,
        createdAt: timestamp,
      })
      .onConflictDoNothing()
      .run();
    for (const edition of db
      .select({
        id: occurrences.id,
        key: occurrences.occurrenceKey,
        state: occurrences.publicationState,
      })
      .from(occurrences)
      .where(eq(occurrences.eventId, event.id))
      .all()) {
      if (edition.state !== "published") continue;
      db.insert(urlAliases)
        .values({
          scope: "festivals",
          path: `/events/${parent.slug}/${edition.key}`,
          eventId: event.id,
          occurrenceId: edition.id,
          createdAt: timestamp,
        })
        .onConflictDoNothing()
        .run();
    }
  });
  return event;
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
