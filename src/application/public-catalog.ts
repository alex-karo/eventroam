import type Database from "better-sqlite3";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  notExists,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { alias, unionAll } from "drizzle-orm/sqlite-core";
import {
  events,
  externalLinks,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
  urlAliases,
} from "../db/schema";

export type PublicOccurrence = {
  id: string;
  eventId: string;
  key: string;
  eventSlug: string;
  eventName: string;
  name: string | null;
  year: number;
  startsOn: string;
  endsOn: string;
  dateState: "confirmed" | "provisional";
  status: "announced" | "scheduled" | "postponed" | "cancelled";
  ticketAvailability: "unknown" | "available" | "sold_out";
  venueName: string | null;
  venueAddress: string | null;
  locality: string | null;
  administrativeArea: string | null;
  countryCode: string;
  hasCoordinates: boolean;
  capacityEstimate: number | null;
  priceKind: string | null;
  priceCurrency: string | null;
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  priceCoverage: string | null;
  priceQualification: string | null;
  terms: { facet: string; name: string }[];
  links: { kind: string; url: string; label: string | null }[];
};
export type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  editions: PublicOccurrence[];
};

function publicRows(
  client: Database.Database,
  condition: SQL | undefined,
  newestFirst = false,
) {
  return drizzle(client)
    .select({
      id: occurrences.id,
      eventId: occurrences.eventId,
      occurrenceKey: occurrences.occurrenceKey,
      eventSlug: events.slug,
      eventName: events.canonicalName,
      name: occurrences.displayName,
      year: occurrences.occurrenceYear,
      startsOn: occurrences.startsOn,
      endsOn: occurrences.endsOn,
      dateState: occurrences.dateState,
      status: occurrences.scheduleStatus,
      ticketAvailability: occurrences.ticketAvailability,
      venueName: occurrences.venueName,
      venueAddress: occurrences.venueAddress,
      locality: occurrences.locality,
      administrativeArea: occurrences.administrativeArea,
      countryCode: occurrences.countryCode,
      latitude: occurrences.latitude,
      longitude: occurrences.longitude,
      capacityEstimate: occurrences.capacityEstimate,
      priceKind: occurrences.priceKind,
      priceCurrency: occurrences.priceCurrency,
      priceMinMinor: occurrences.priceMinMinor,
      priceMaxMinor: occurrences.priceMaxMinor,
      priceCoverage: occurrences.priceCoverage,
      priceQualification: occurrences.priceQualification,
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
        condition,
      ),
    )
    .orderBy(
      newestFirst ? desc(occurrences.startsOn) : asc(occurrences.startsOn),
      asc(occurrences.id),
    )
    .all();
}

type Row = ReturnType<typeof publicRows>[number];

function enrich(client: Database.Database, rows: Row[]): PublicOccurrence[] {
  if (!rows.length) return [];
  const db = drizzle(client);
  const ids = rows.map((row) => row.id);
  const terms = db
    .select({
      occurrenceId: occurrenceTerms.occurrenceId,
      facet: taxonomyTerms.facet,
      name: taxonomyTerms.name,
    })
    .from(occurrenceTerms)
    .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, occurrenceTerms.termId))
    .where(
      inArray(
        occurrenceTerms.occurrenceId,
        sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`,
      ),
    )
    .orderBy(
      asc(taxonomyTerms.facet),
      asc(taxonomyTerms.name),
      asc(taxonomyTerms.id),
    )
    .all();
  const termsByOccurrence = new Map<string, PublicOccurrence["terms"]>();
  for (const { occurrenceId, ...term } of terms) {
    const assigned = termsByOccurrence.get(occurrenceId) ?? [];
    assigned.push(term);
    termsByOccurrence.set(occurrenceId, assigned);
  }
  const selected = db
    .select({ id: occurrences.id, eventId: occurrences.eventId })
    .from(occurrences)
    .where(
      inArray(
        occurrences.id,
        sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`,
      ),
    )
    .as("selected");
  const own = alias(externalLinks, "own");
  const editionLinks = db
    .select({
      occurrenceId: selected.id,
      kind: externalLinks.kind,
      url: externalLinks.url,
      label: externalLinks.label,
    })
    .from(selected)
    .innerJoin(externalLinks, eq(externalLinks.occurrenceId, selected.id))
    .where(eq(externalLinks.official, true));
  const inheritedLinks = db
    .select({
      occurrenceId: selected.id,
      kind: externalLinks.kind,
      url: externalLinks.url,
      label: externalLinks.label,
    })
    .from(selected)
    .innerJoin(externalLinks, eq(externalLinks.eventId, selected.eventId))
    .where(
      and(
        eq(externalLinks.official, true),
        notExists(
          db
            .select({ id: own.id })
            .from(own)
            .where(
              and(
                eq(own.occurrenceId, selected.id),
                eq(own.kind, externalLinks.kind),
              ),
            ),
        ),
      ),
    );
  const links = unionAll(editionLinks, inheritedLinks)
    .all()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.url.localeCompare(b.url));
  const linksByOccurrence = new Map<string, PublicOccurrence["links"]>();
  for (const { occurrenceId, ...link } of links) {
    const assigned = linksByOccurrence.get(occurrenceId) ?? [];
    assigned.push(link);
    linksByOccurrence.set(occurrenceId, assigned);
  }
  return rows.map(({ occurrenceKey, latitude, longitude, ...fields }) => ({
    ...fields,
    key: occurrenceKey,
    year: fields.year!,
    startsOn: fields.startsOn!,
    endsOn: fields.endsOn!,
    dateState: fields.dateState as PublicOccurrence["dateState"],
    countryCode: fields.countryCode!,
    hasCoordinates: latitude !== null && longitude !== null,
    terms: termsByOccurrence.get(fields.id) ?? [],
    links: linksByOccurrence.get(fields.id) ?? [],
  }));
}

export function publicEditions(
  client: Database.Database,
  eventId: string,
): PublicOccurrence[] {
  return enrich(client, publicRows(client, eq(events.id, eventId), true));
}

export function publicEvent(
  client: Database.Database,
  eventId: string,
): PublicEvent | null {
  const event = drizzle(client)
    .select({
      id: events.id,
      slug: events.slug,
      name: events.canonicalName,
      summary: events.summary,
    })
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.publicationState, "published"),
        eq(events.homeScope, "festivals"),
      ),
    )
    .get();
  if (!event) return null;
  const editions = publicEditions(client, eventId);
  return editions.length ? { ...event, editions } : null;
}

export function publicOccurrenceById(
  client: Database.Database,
  id: string,
): PublicOccurrence | null {
  const row = publicRows(
    client,
    and(
      eq(occurrences.id, id),
      notInArray(occurrences.scheduleStatus, ["cancelled", "postponed"]),
    ),
  )[0];
  return row ? enrich(client, [row])[0] : null;
}

export function selectActive(
  editions: PublicOccurrence[],
  today: string,
): PublicOccurrence | null {
  const eligible = editions.filter(
    (o) =>
      o.status !== "cancelled" && o.status !== "postponed" && o.endsOn >= today,
  );
  eligible.sort((a, b) => {
    const rank = (o: PublicOccurrence) => (o.startsOn <= today ? 0 : 1);
    return (
      rank(a) - rank(b) ||
      a.startsOn.localeCompare(b.startsOn) ||
      a.id.localeCompare(b.id)
    );
  });
  return eligible[0] ?? null;
}

export function resolvePublicPath(
  client: Database.Database,
  path: string,
): {
  event: PublicEvent;
  edition: PublicOccurrence | null;
  redirect: boolean;
} | null {
  const canonical =
    /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(
      path,
    );
  if (!canonical) return null;
  const stored = drizzle(client)
    .select({
      eventId: urlAliases.eventId,
      occurrenceId: urlAliases.occurrenceId,
    })
    .from(urlAliases)
    .where(and(eq(urlAliases.scope, "festivals"), eq(urlAliases.path, path)))
    .get();
  // Only stored public addresses are routable. The identity is checked again below.
  if (!stored) return null;
  const event = publicEvent(client, stored.eventId);
  if (!event) return null;
  const edition = stored.occurrenceId
    ? (event.editions.find((o) => o.id === stored.occurrenceId) ?? null)
    : null;
  if (stored.occurrenceId && !edition) return null;
  const current = `/events/${event.slug}${edition ? `/${edition.key}` : ""}`;
  return { event, edition, redirect: current !== path };
}
