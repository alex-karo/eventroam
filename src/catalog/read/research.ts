import type Database from "better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
} from "@/db/schema";

export type ResearchEvent = NonNullable<ReturnType<typeof readResearchEvent>>;

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
