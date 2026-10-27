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
  editionTerms,
  editions,
  taxonomyTerms,
  urlAliases,
} from "@/db/schema";

import type { PublicEvent, PublicEdition } from "@/catalog/read/contracts";

function publicEditionConditions() {
  return and(
    eq(events.publicationState, "published"),
    eq(events.homeScope, "festivals"),
    eq(editions.publicationState, "published"),
    isNotNull(editions.startsOn),
    isNotNull(editions.endsOn),
  );
}

export function publicUrlRecords(client: Database.Database) {
  return drizzle(client)
    .select({ eventSlug: events.slug, editionKey: editions.editionKey })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(publicEditionConditions())
    .orderBy(asc(events.slug), asc(editions.editionKey))
    .all();
}

function publicRows(
  client: Database.Database,
  condition: SQL | undefined,
  newestFirst = false,
) {
  return drizzle(client)
    .select({
      id: editions.id,
      eventId: editions.eventId,
      editionKey: editions.editionKey,
      eventSlug: events.slug,
      eventName: events.canonicalName,
      name: editions.displayName,
      year: editions.editionYear,
      startsOn: editions.startsOn,
      endsOn: editions.endsOn,
      dateState: editions.dateState,
      status: editions.scheduleStatus,
      priceDetails: editions.priceDetails,
      venueName: editions.venueName,
      venueAddress: editions.venueAddress,
      locality: editions.locality,
      administrativeArea: editions.administrativeArea,
      countryCode: editions.countryCode,
      latitude: editions.latitude,
      longitude: editions.longitude,
      coordinatePrecision: editions.coordinatePrecision,
      timeZone: editions.timeZone,
      sizeEstimate: editions.sizeEstimate,
      priceKind: editions.priceKind,
      priceCurrency: editions.priceCurrency,
      priceMinMinor: editions.priceMinMinor,
      priceMaxMinor: editions.priceMaxMinor,
      priceCoverage: editions.priceCoverage,
      priceQualification: editions.priceQualification,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(and(publicEditionConditions(), condition))
    .orderBy(
      newestFirst ? desc(editions.startsOn) : asc(editions.startsOn),
      asc(editions.id),
    )
    .all();
}

type Row = ReturnType<typeof publicRows>[number];

function enrich(client: Database.Database, rows: Row[]): PublicEdition[] {
  if (!rows.length) {
    return [];
  }
  const db = drizzle(client);
  const ids = rows.map((row) => row.id);
  const terms = db
    .select({
      editionId: editionTerms.editionId,
      facet: taxonomyTerms.facet,
      name: taxonomyTerms.name,
    })
    .from(editionTerms)
    .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, editionTerms.termId))
    .where(
      inArray(
        editionTerms.editionId,
        sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`,
      ),
    )
    .orderBy(
      asc(taxonomyTerms.facet),
      asc(taxonomyTerms.name),
      asc(taxonomyTerms.id),
    )
    .all();
  const termsByEdition = new Map<string, PublicEdition["terms"]>();
  for (const { editionId, ...term } of terms) {
    const assigned = termsByEdition.get(editionId) ?? [];
    assigned.push(term);
    termsByEdition.set(editionId, assigned);
  }
  const selected = db
    .select({ id: editions.id, eventId: editions.eventId })
    .from(editions)
    .where(
      inArray(
        editions.id,
        sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`,
      ),
    )
    .as("selected");
  const own = alias(externalLinks, "own");
  const editionLinks = db
    .select({
      editionId: selected.id,
      kind: externalLinks.kind,
      url: externalLinks.url,
      label: externalLinks.label,
    })
    .from(selected)
    .innerJoin(externalLinks, eq(externalLinks.editionId, selected.id))
    .where(eq(externalLinks.official, true));
  const inheritedLinks = db
    .select({
      editionId: selected.id,
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
                eq(own.editionId, selected.id),
                eq(own.kind, externalLinks.kind),
              ),
            ),
        ),
      ),
    );
  const links = unionAll(editionLinks, inheritedLinks)
    .all()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.url.localeCompare(b.url));
  const linksByEdition = new Map<string, PublicEdition["links"]>();
  for (const { editionId, ...link } of links) {
    const assigned = linksByEdition.get(editionId) ?? [];
    assigned.push(link);
    linksByEdition.set(editionId, assigned);
  }
  return rows.map(({ editionKey, priceDetails, ...fields }) => ({
    ...fields,
    key: editionKey,
    year: fields.year!,
    startsOn: fields.startsOn!,
    endsOn: fields.endsOn!,
    dateState: fields.dateState as PublicEdition["dateState"],
    countryCode: fields.countryCode!,
    ticketCategories: priceDetails.map(
      ({ label, amount, currency, terms, availability }) => ({
        label,
        ...(amount !== undefined ? { amount } : {}),
        ...(currency ? { currency } : {}),
        ...(terms ? { terms } : {}),
        ...(availability ? { availability } : {}),
      }),
    ),
    terms: termsByEdition.get(fields.id) ?? [],
    links: linksByEdition.get(fields.id) ?? [],
  }));
}

export function publicEditions(
  client: Database.Database,
  eventId: string,
): PublicEdition[] {
  return client.transaction(() =>
    enrich(client, publicRows(client, eq(events.id, eventId), true)),
  )();
}

export function publicEvent(
  client: Database.Database,
  eventId: string,
): PublicEvent | null {
  return client.transaction(() => {
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
    if (!event) {
      return null;
    }
    const editions = publicEditions(client, eventId);
    return editions.length ? { ...event, editions } : null;
  })();
}

export function publicEditionById(
  client: Database.Database,
  id: string,
): PublicEdition | null {
  return client.transaction(() => {
    const row = publicRows(
      client,
      and(
        eq(editions.id, id),
        notInArray(editions.scheduleStatus, ["cancelled", "postponed"]),
      ),
    )[0];
    return row ? enrich(client, [row])[0] : null;
  })();
}

export function resolvePublicPath(
  client: Database.Database,
  path: string,
): {
  event: PublicEvent;
  edition: PublicEdition | null;
  redirect: boolean;
} | null {
  const canonical =
    /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(
      path,
    );
  if (!canonical) {
    return null;
  }
  return client.transaction(() => {
    const stored = drizzle(client)
      .select({
        eventId: urlAliases.eventId,
        editionId: urlAliases.editionId,
      })
      .from(urlAliases)
      .where(and(eq(urlAliases.scope, "festivals"), eq(urlAliases.path, path)))
      .get();
    // Only stored public addresses are routable. The identity is checked again below.
    if (!stored) {
      return null;
    }
    const event = publicEvent(client, stored.eventId);
    if (!event) {
      return null;
    }
    const edition = stored.editionId
      ? (event.editions.find((o) => o.id === stored.editionId) ?? null)
      : null;
    if (stored.editionId && !edition) {
      return null;
    }
    const editionSuffix = edition ? `/${edition.key}` : "";
    const current = `/events/${event.slug}${editionSuffix}`;
    return { event, edition, redirect: current !== path };
  })();
}
