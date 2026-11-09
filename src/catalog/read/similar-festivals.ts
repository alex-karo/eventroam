import type Database from "better-sqlite3";
import { and, isNull, ne } from "drizzle-orm";
import { isPastEdition } from "@/catalog/domain/dates";
import { editions, events } from "@/db/schema";
import type { Genre, PublicEvent, SimilarFestival } from "./contracts";
import {
  discoveryGenres,
  genreSlugsByEdition,
  publicSummaryRows,
} from "./discovery";

function genreAncestors(
  slugs: string[],
  genresBySlug: ReadonlyMap<string, Genre>,
): Set<Genre> {
  const ancestors = new Set<Genre>();
  for (const slug of slugs) {
    let genre = genresBySlug.get(slug);
    while (genre && !ancestors.has(genre)) {
      ancestors.add(genre);
      genre = genre.parentSlug ? genresBySlug.get(genre.parentSlug) : undefined;
    }
  }
  return ancestors;
}

export function similarFestivals(
  client: Database.Database,
  event: PublicEvent,
  now: Date,
): SimilarFestival[] {
  // Public Event history has the newest start date first.
  const source =
    event.editions.findLast((edition) => !isPastEdition(edition, now)) ??
    event.editions[0];
  if (!source) {
    return [];
  }

  const { rows, genresByEdition, genreTree } = client.transaction(() => {
    const rows = publicSummaryRows(
      client,
      and(ne(events.id, event.id), isNull(editions.soldOutSourceUrl)),
    ).filter((edition) => !isPastEdition(edition, now));
    return {
      rows,
      genresByEdition: genreSlugsByEdition(client, [
        source.id,
        ...rows.map((row) => row.id),
      ]),
      genreTree: discoveryGenres(client),
    };
  })();

  const sourceSlugs = genresByEdition.get(source.id);
  if (!sourceSlugs?.length) {
    return [];
  }
  const genresBySlug = new Map(genreTree.map((genre) => [genre.slug, genre]));
  const sourceGenres = [...genreAncestors(sourceSlugs, genresBySlug)]
    .map((genre) => ({
      genre,
      depth: genreAncestors([genre.slug], genresBySlug).size - 1,
    }))
    .sort((a, b) => b.depth - a.depth);
  const matches = new Map<
    string,
    { festival: SimilarFestival; depth: number }
  >();
  for (const row of rows) {
    if (matches.has(row.eventSlug)) {
      continue;
    }
    const genres = genresByEdition.get(row.id) ?? [];
    const candidateGenres = genreAncestors(genres, genresBySlug);
    const shared = sourceGenres.find(({ genre }) => candidateGenres.has(genre));
    if (shared) {
      matches.set(row.eventSlug, {
        festival: {
          edition: { ...row, genres },
          sharedGenreName: shared.genre.name,
        },
        depth: shared.depth,
      });
    }
  }
  return [...matches.values()]
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 3)
    .map(({ festival }) => festival);
}
