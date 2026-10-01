import type Database from "better-sqlite3";

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

type Row = Omit<
  PublicOccurrence,
  | "key"
  | "eventSlug"
  | "eventName"
  | "name"
  | "status"
  | "hasCoordinates"
  | "terms"
  | "links"
> & {
  occurrenceKey: string;
  eventSlug: string;
  eventName: string;
  name: string | null;
  status: PublicOccurrence["status"];
  latitude: number | null;
  longitude: number | null;
};
const select = `SELECT o.id,o.event_id AS eventId,o.occurrence_key AS occurrenceKey,
 e.slug AS eventSlug,e.canonical_name AS eventName,o.display_name AS name,
 o.occurrence_year AS year,o.starts_on AS startsOn,o.ends_on AS endsOn,
 o.date_state AS dateState,o.schedule_status AS status,o.ticket_availability AS ticketAvailability,
 o.venue_name AS venueName,o.venue_address AS venueAddress,o.locality,
 o.administrative_area AS administrativeArea,o.country_code AS countryCode,
 o.latitude,o.longitude,o.capacity_estimate AS capacityEstimate,
 o.price_kind AS priceKind,o.price_currency AS priceCurrency,
 o.price_min_minor AS priceMinMinor,o.price_max_minor AS priceMaxMinor,
 o.price_coverage AS priceCoverage,o.price_qualification AS priceQualification
 FROM occurrences o JOIN events e ON e.id=o.event_id
 WHERE e.publication_state='published' AND e.home_scope='festivals'
 AND o.publication_state='published' AND o.starts_on IS NOT NULL AND o.ends_on IS NOT NULL`;

function enrich(client: Database.Database, row: Row): PublicOccurrence {
  const terms = client
    .prepare(
      `SELECT t.facet,t.name FROM occurrence_terms ot JOIN taxonomy_terms t ON t.id=ot.term_id WHERE ot.occurrence_id=? ORDER BY t.facet,t.name,t.id`,
    )
    .all(row.id) as PublicOccurrence["terms"];
  // Edition links override event links of the same kind. Never expose source IDs.
  const links = client
    .prepare(
      `SELECT kind,url,label FROM external_links WHERE official=1 AND occurrence_id=?
    UNION ALL SELECT kind,url,label FROM external_links el WHERE official=1 AND event_id=?
    AND NOT EXISTS(SELECT 1 FROM external_links own WHERE own.occurrence_id=? AND own.kind=el.kind)
    ORDER BY kind,url`,
    )
    .all(row.id, row.eventId, row.id) as PublicOccurrence["links"];
  const { occurrenceKey, latitude, longitude, ...publicFields } = row;
  return {
    ...publicFields,
    key: occurrenceKey,
    hasCoordinates: latitude !== null && longitude !== null,
    terms,
    links,
  };
}
export function publicEditions(
  client: Database.Database,
  eventId: string,
): PublicOccurrence[] {
  const rows = client
    .prepare(`${select} AND e.id=? ORDER BY o.starts_on DESC,o.id`)
    .all(eventId) as Row[];
  return rows.map((row) => enrich(client, row));
}
export function publicEvent(
  client: Database.Database,
  eventId: string,
): PublicEvent | null {
  const event = client
    .prepare(
      `SELECT id,slug,canonical_name AS name,summary FROM events WHERE id=? AND publication_state='published' AND home_scope='festivals'`,
    )
    .get(eventId) as Omit<PublicEvent, "editions"> | undefined;
  if (!event) return null;
  const editions = publicEditions(client, eventId);
  return editions.length ? { ...event, editions } : null;
}
export function publicOccurrenceById(
  client: Database.Database,
  id: string,
): PublicOccurrence | null {
  const row = client
    .prepare(
      `${select} AND o.id=? AND o.schedule_status NOT IN ('cancelled','postponed')`,
    )
    .get(id) as Row | undefined;
  return row ? enrich(client, row) : null;
}
export function publicList(
  client: Database.Database,
  today: string,
): PublicOccurrence[] {
  const rows = client
    .prepare(
      `${select} AND o.ends_on>=? AND o.schedule_status NOT IN ('cancelled','postponed') ORDER BY o.starts_on,o.id`,
    )
    .all(today) as Row[];
  return rows.map((row) => enrich(client, row));
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
  const alias = client
    .prepare(
      `SELECT event_id AS eventId,occurrence_id AS occurrenceId FROM url_aliases WHERE scope='festivals' AND path=?`,
    )
    .get(path) as { eventId: string; occurrenceId: string | null } | undefined;
  // Only stored public addresses are routable. The identity is checked again below.
  if (!alias) return null;
  const event = publicEvent(client, alias.eventId);
  if (!event) return null;
  const edition = alias.occurrenceId
    ? (event.editions.find((o) => o.id === alias.occurrenceId) ?? null)
    : null;
  if (alias.occurrenceId && !edition) return null;
  const current = `/events/${event.slug}${edition ? `/${edition.key}` : ""}`;
  return { event, edition, redirect: current !== path };
}
