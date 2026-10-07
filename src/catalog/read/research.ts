import type Database from "better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  catalogChanges,
  events,
  externalLinks,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
} from "@/db/schema";

export type ResearchEvent = NonNullable<ReturnType<typeof readResearchEvent>>;

/** Private management context; includes drafts and audit attribution. Never use in public routes. */
export function readResearchEvent(client: Database.Database, eventId: string) {
  const db = drizzle(client);
  const event = db.select().from(events).where(eq(events.id, eventId)).get();
  if (!event) {
    return null;
  }
  const editions = db
    .select()
    .from(occurrences)
    .where(eq(occurrences.eventId, eventId))
    .orderBy(asc(occurrences.occurrenceYear), asc(occurrences.id))
    .all();
  const linksFor = (owner: { type: "event" | "occurrence"; id: string }) =>
    db
      .select()
      .from(externalLinks)
      .where(
        owner.type === "event"
          ? eq(externalLinks.eventId, owner.id)
          : eq(externalLinks.occurrenceId, owner.id),
      )
      .all();
  const changesFor = (owner: { type: "event" | "occurrence"; id: string }) =>
    db
      .select()
      .from(catalogChanges)
      .where(
        owner.type === "event"
          ? eq(catalogChanges.eventId, owner.id)
          : eq(catalogChanges.occurrenceId, owner.id),
      )
      .orderBy(asc(catalogChanges.subjectVersion))
      .all();
  return {
    ...event,
    links: linksFor({ type: "event", id: event.id }),
    changes: changesFor({ type: "event", id: event.id }),
    editions: editions.map((edition) => ({
      ...edition,
      links: linksFor({ type: "occurrence", id: edition.id }),
      terms: db
        .select({
          id: taxonomyTerms.id,
          facet: taxonomyTerms.facet,
          slug: taxonomyTerms.slug,
          name: taxonomyTerms.name,
          parentId: taxonomyTerms.parentId,
        })
        .from(occurrenceTerms)
        .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, occurrenceTerms.termId))
        .where(eq(occurrenceTerms.occurrenceId, edition.id))
        .all(),
      changes: changesFor({ type: "occurrence", id: edition.id }),
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
