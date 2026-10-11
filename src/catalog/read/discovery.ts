import type Database from "better-sqlite3";
import { and, asc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { alias } from "drizzle-orm/sqlite-core";
import { events, editionTerms, editions, taxonomyTerms } from "@/db/schema";
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
      id: editions.id,
      eventSlug: events.slug,
      eventName: events.canonicalName,
      aliases: events.aliases,
      name: editions.displayName,
      year: editions.editionYear,
      editionKey: editions.editionKey,
      startsOn: editions.startsOn,
      endsOn: editions.endsOn,
      dateState: editions.dateState,
      status: editions.scheduleStatus,
      countryCode: editions.countryCode,
      locality: editions.locality,
      administrativeArea: editions.administrativeArea,
      venueName: editions.venueName,
      latitude: editions.latitude,
      longitude: editions.longitude,
      coordinatePrecision: editions.coordinatePrecision,
      timeZone: editions.timeZone,
      sizeEstimate: editions.sizeEstimate,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(
      and(
        eq(events.publicationState, "published"),
        eq(events.homeScope, "festivals"),
        eq(editions.publicationState, "published"),
        isNotNull(editions.startsOn),
        isNotNull(editions.endsOn),
        notInArray(editions.scheduleStatus, ["cancelled", "postponed"]),
      ),
    )
    .orderBy(
      asc(editions.startsOn),
      asc(events.canonicalName),
      asc(editions.id),
    )
    .all();
  const genresByEdition = new Map<string, string[]>();
  if (rows.length) {
    const classifications = db
      .select({
        editionId: editionTerms.editionId,
        slug: taxonomyTerms.slug,
      })
      .from(editionTerms)
      .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, editionTerms.termId))
      .where(
        and(
          inArray(
            editionTerms.editionId,
            sql`(SELECT value FROM json_each(${JSON.stringify(rows.map((row) => row.id))}))`,
          ),
          eq(taxonomyTerms.facet, "genre"),
        ),
      )
      .orderBy(asc(taxonomyTerms.slug))
      .all();
    for (const { editionId, slug } of classifications) {
      const genres = genresByEdition.get(editionId) ?? [];
      genres.push(slug);
      genresByEdition.set(editionId, genres);
    }
  }
  return rows.map(({ editionKey, ...row }) => ({
    ...row,
    key: editionKey,
    genres: genresByEdition.get(row.id) ?? [],
  })) as DiscoverySummary[];
}

export function discoveryCatalog(client: Database.Database) {
  return client.transaction(() => ({
    genres: discoveryGenres(client),
    summaries: publicSummaries(client),
  }))();
}
