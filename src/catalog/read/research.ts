import type Database from "better-sqlite3";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
} from "@/db/schema";

export type ResearchEvent = NonNullable<ReturnType<typeof readResearchEvent>>;

/** Private name lookup for add requests; no Edition or link data. */
export function readResearchNames(client: Database.Database) {
  return drizzle(client)
    .select({
      id: events.id,
      canonicalName: events.canonicalName,
      aliases: events.aliases,
    })
    .from(events)
    .orderBy(asc(events.id))
    .all();
}

/** Only distinct known countries for the name candidates. */
export function readResearchCountries(
  client: Database.Database,
  eventIds: string[],
) {
  return drizzle(client)
    .selectDistinct({
      eventId: editions.eventId,
      countryCode: editions.countryCode,
    })
    .from(editions)
    .where(
      and(inArray(editions.eventId, eventIds), isNotNull(editions.countryCode)),
    )
    .all();
}

/** Includes other Events so that conflicting input URLs can be detected. */
export function readResearchOfficialLinks(client: Database.Database) {
  return drizzle(client)
    .select({ eventId: externalLinks.eventId, url: externalLinks.url })
    .from(externalLinks)
    .where(
      and(eq(externalLinks.official, true), isNotNull(externalLinks.eventId)),
    )
    .all();
}

/** Only the fields used by the atomic refresh country guard; null means no Event. */
export function readResearchCountryBaseline(
  client: Database.Database,
  eventId: string,
) {
  const db = drizzle(client);
  if (
    !db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, eventId))
      .get()
  ) {
    return null;
  }
  return db
    .select({ id: editions.id, countryCode: editions.countryCode })
    .from(editions)
    .where(eq(editions.eventId, eventId))
    .all();
}

/** Private management context; includes drafts and accepted facts. Never use in public routes. */
export function readResearchEvent(client: Database.Database, eventId: string) {
  const db = drizzle(client);
  const event = db.select().from(events).where(eq(events.id, eventId)).get();
  if (!event) {
    return null;
  }
  const savedEditions = db
    .select()
    .from(editions)
    .where(eq(editions.eventId, eventId))
    .orderBy(asc(editions.editionYear), asc(editions.id))
    .all();
  const linksFor = (owner: { type: "event" | "edition"; id: string }) =>
    db
      .select()
      .from(externalLinks)
      .where(
        owner.type === "event"
          ? eq(externalLinks.eventId, owner.id)
          : eq(externalLinks.editionId, owner.id),
      )
      .all();
  return {
    ...event,
    links: linksFor({ type: "event", id: event.id }),
    editions: savedEditions.map((edition) => ({
      ...edition,
      links: linksFor({ type: "edition", id: edition.id }),
      terms: db
        .select({
          id: taxonomyTerms.id,
          facet: taxonomyTerms.facet,
          slug: taxonomyTerms.slug,
          name: taxonomyTerms.name,
          parentId: taxonomyTerms.parentId,
        })
        .from(editionTerms)
        .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, editionTerms.termId))
        .where(eq(editionTerms.editionId, edition.id))
        .all(),
    })),
  };
}

export function readResearchCatalog(client: Database.Database) {
  const ids = drizzle(client)
    .select({ id: events.id })
    .from(events)
    .orderBy(asc(events.canonicalName), asc(events.id))
    .all();
  return ids.map(({ id }) => readResearchEvent(client, id)!);
}

/** Taxonomy context for ingestion validation and ancestor normalization. */
export function readResearchTerms(client: Database.Database) {
  return drizzle(client)
    .select({
      id: taxonomyTerms.id,
      facet: taxonomyTerms.facet,
      slug: taxonomyTerms.slug,
      parentId: taxonomyTerms.parentId,
      description: taxonomyTerms.description,
    })
    .from(taxonomyTerms)
    .all()
    .map(({ description, ...term }) => ({
      ...term,
      ...(description != null && { description }),
    }));
}
