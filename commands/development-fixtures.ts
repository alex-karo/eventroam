import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  events,
  externalLinks,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
  urlAliases,
} from "@/db/schema";

const termIds = ["dev-festival", "dev-outdoor", "dev-music"];
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
  return drizzle(client).transaction((db) => {
    for (const [id, facet, slug, name] of [
      ["dev-festival", "event_type", "festival", "Festival"],
      ["dev-outdoor", "format", "outdoor", "Outdoor"],
      ["dev-music", "topic", "music", "Music"],
    ] as const) {
      db.insert(taxonomyTerms)
        .values({ id, facet, slug, name })
        .onConflictDoNothing()
        .run();
    }

    function addEvent(slug: string, canonicalName: string) {
      const existing = db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .get();
      if (existing) {
        return { id: existing.id, created: false };
      }
      const id = randomUUID();
      db.insert(events)
        .values({
          id,
          slug,
          canonicalName,
          homeScope: "festivals",
          publicationState: "published",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(urlAliases)
        .values({
          scope: "festivals",
          path: `/events/${slug}`,
          eventId: id,
          createdAt: now,
        })
        .run();
      return { id, created: true };
    }

    function addOccurrence(
      eventId: string,
      data: Omit<
        typeof occurrences.$inferInsert,
        "id" | "eventId" | "createdAt" | "updatedAt"
      >,
    ) {
      const id = randomUUID();
      db.insert(occurrences)
        .values({ id, eventId, ...data, createdAt: now, updatedAt: now })
        .run();
      const parent = db
        .select({ slug: events.slug })
        .from(events)
        .where(eq(events.id, eventId))
        .get()!;
      db.insert(urlAliases)
        .values({
          scope: "festivals",
          path: `/events/${parent.slug}/${data.occurrenceKey}`,
          eventId,
          occurrenceId: id,
          createdAt: now,
        })
        .run();
      for (const termId of termIds) {
        db.insert(occurrenceTerms).values({ occurrenceId: id, termId }).run();
      }
    }

    const event = addEvent("fictional-field-days", "Fictional Field Days");
    if (event.created) {
      for (const [key, year, start, end, status] of [
        ["2025", 2025, "2025-07-01", "2025-07-03", "scheduled"],
        ["2027", 2027, "2027-07-01", "2027-07-03", "scheduled"],
        ["2026-cancelled", 2026, "2026-07-01", "2026-07-03", "cancelled"],
      ] as const) {
        addOccurrence(event.id, {
          occurrenceKey: key,
          occurrenceYear: year,
          startsOn: start,
          endsOn: end,
          dateState: year === 2027 ? "provisional" : "confirmed",
          scheduleStatus: status,
          countryCode: "PT",
          locality: "Example Valley",
          publicationState: "published",
        });
      }
    }

    for (const example of geographicExamples) {
      const added = addEvent(example.slug, example.name);
      if (!added.created) {
        continue;
      }
      addOccurrence(added.id, {
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
        publicationState: "published",
      });
      db.insert(externalLinks)
        .values({
          id: randomUUID(),
          eventId: added.id,
          kind: "official_site",
          url: `https://example.org/${example.slug}`,
          label: "Fictional festival website",
          official: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    return event.id;
  });
}
