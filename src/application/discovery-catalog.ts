import type Database from "better-sqlite3";
import type { DiscoverySummary, Genre } from "./discovery";

type Row = Omit<DiscoverySummary, "aliases" | "genres" | "key"> & {
  aliasesJson: string;
  occurrenceKey: string;
};

export function discoveryGenres(client: Database.Database): Genre[] {
  return client
    .prepare(
      `SELECT t.slug,t.name,p.slug AS parentSlug FROM taxonomy_terms t
       LEFT JOIN taxonomy_terms p ON p.id=t.parent_id
       WHERE t.facet='genre' ORDER BY t.name,t.slug`,
    )
    .all() as Genre[];
}

export function publicSummaries(client: Database.Database): DiscoverySummary[] {
  const rows = client
    .prepare(
      `SELECT o.id,e.slug AS eventSlug,e.canonical_name AS eventName,e.aliases AS aliasesJson,
    o.display_name AS name,o.occurrence_year AS year,o.occurrence_key AS occurrenceKey,
    o.starts_on AS startsOn,o.ends_on AS endsOn,o.date_state AS dateState,
    o.schedule_status AS status,o.ticket_availability AS ticketAvailability,
    o.country_code AS countryCode,o.locality,o.administrative_area AS administrativeArea,
    o.venue_name AS venueName,o.latitude,o.longitude,o.coordinate_precision AS coordinatePrecision,
    o.time_zone AS timeZone,o.capacity_estimate AS capacityEstimate
    FROM occurrences o JOIN events e ON e.id=o.event_id
    WHERE e.publication_state='published' AND e.home_scope='festivals'
    AND o.publication_state='published' AND o.starts_on IS NOT NULL AND o.ends_on IS NOT NULL
    AND o.schedule_status NOT IN ('cancelled','postponed')
    ORDER BY o.starts_on,e.canonical_name,o.id`,
    )
    .all() as Row[];
  const genresByOccurrence = new Map<string, string[]>();
  const classifications = client.prepare(
    `SELECT ot.occurrence_id AS occurrenceId,t.slug
     FROM occurrence_terms ot JOIN taxonomy_terms t ON t.id=ot.term_id
     WHERE ot.occurrence_id IN (SELECT value FROM json_each(?))
     AND t.facet='genre' ORDER BY t.slug`,
  ).all(JSON.stringify(rows.map((row) => row.id))) as { occurrenceId: string; slug: string }[];
  for (const { occurrenceId, slug } of classifications) {
    const genres = genresByOccurrence.get(occurrenceId) ?? [];
    genres.push(slug);
    genresByOccurrence.set(occurrenceId, genres);
  }
  return rows.map(({ aliasesJson, occurrenceKey, ...row }) => ({
    ...row,
    key: occurrenceKey,
    aliases: JSON.parse(aliasesJson) as string[],
    genres: genresByOccurrence.get(row.id) ?? [],
  }));
}

export function discoveryCatalog(client: Database.Database) {
  return { genres: discoveryGenres(client), summaries: publicSummaries(client) };
}
