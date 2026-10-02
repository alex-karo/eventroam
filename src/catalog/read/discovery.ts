import type Database from "better-sqlite3";
import { and, asc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { alias } from "drizzle-orm/sqlite-core";
import {
  events,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
} from "@/db/schema";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";

export function discoveryGenres(client: Database.Database): Genre[] {
  const parent = alias(taxonomyTerms, "parent");
  return drizzle(client)
    .select({
      slug: taxonomyTerms.slug,
      name: taxonomyTerms.name,
      parentSlug: parent.slug,
    })
    .from(taxonomyTerms)
    .leftJoin(parent, eq(parent.id, taxonomyTerms.parentId))
    .where(eq(taxonomyTerms.facet, "genre"))
    .orderBy(asc(taxonomyTerms.name), asc(taxonomyTerms.slug))
    .all();
}

export function publicSummaries(client: Database.Database): DiscoverySummary[] {
  const db = drizzle(client);
  const rows = db
    .select({
      id: occurrences.id,
      eventSlug: events.slug,
      eventName: events.canonicalName,
      aliases: events.aliases,
      name: occurrences.displayName,
      year: occurrences.occurrenceYear,
      occurrenceKey: occurrences.occurrenceKey,
      startsOn: occurrences.startsOn,
      endsOn: occurrences.endsOn,
      dateState: occurrences.dateState,
      status: occurrences.scheduleStatus,
      ticketAvailability: occurrences.ticketAvailability,
      countryCode: occurrences.countryCode,
      locality: occurrences.locality,
      administrativeArea: occurrences.administrativeArea,
      venueName: occurrences.venueName,
      latitude: occurrences.latitude,
      longitude: occurrences.longitude,
      coordinatePrecision: occurrences.coordinatePrecision,
      timeZone: occurrences.timeZone,
      capacityEstimate: occurrences.capacityEstimate,
    })
    .from(occurrences)
    .innerJoin(events, eq(events.id, occurrences.eventId))
    .where(
      and(
        eq(events.publicationState, "published"),
        eq(events.homeScope, "festivals"),
        eq(occurrences.publicationState, "published"),
        isNotNull(occurrences.startsOn),
        isNotNull(occurrences.endsOn),
        notInArray(occurrences.scheduleStatus, ["cancelled", "postponed"]),
      ),
    )
    .orderBy(
      asc(occurrences.startsOn),
      asc(events.canonicalName),
      asc(occurrences.id),
    )
    .all();
  const genresByOccurrence = new Map<string, string[]>();
  if (rows.length) {
    const classifications = db
      .select({
        occurrenceId: occurrenceTerms.occurrenceId,
        slug: taxonomyTerms.slug,
      })
      .from(occurrenceTerms)
      .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, occurrenceTerms.termId))
      .where(
        and(
          inArray(
            occurrenceTerms.occurrenceId,
            sql`(SELECT value FROM json_each(${JSON.stringify(rows.map((row) => row.id))}))`,
          ),
          eq(taxonomyTerms.facet, "genre"),
        ),
      )
      .orderBy(asc(taxonomyTerms.slug))
      .all();
    for (const { occurrenceId, slug } of classifications) {
      const genres = genresByOccurrence.get(occurrenceId) ?? [];
      genres.push(slug);
      genresByOccurrence.set(occurrenceId, genres);
    }
  }
  return rows.map(({ occurrenceKey, ...row }) => ({
    ...row,
    key: occurrenceKey,
    genres: genresByOccurrence.get(row.id) ?? [],
  })) as DiscoverySummary[];
}

export function discoveryCatalog(client: Database.Database) {
  return client.transaction(() => ({
    genres: discoveryGenres(client),
    summaries: publicSummaries(client),
  }))();
}
