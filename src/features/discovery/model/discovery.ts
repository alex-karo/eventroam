import { isAssignedCountryCode } from "@/catalog/domain/country-codes";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";

// This module has no database or React dependencies so direct URLs and browser
// interactions use identical validation, matching, and ordering.
export const sizeBands = [
  "lt-1000",
  "1000-4999",
  "5000-19999",
  "20000-49999",
  "gte-50000",
] as const;
export type SizeBand = (typeof sizeBands)[number];
export type GenreOption = { genre: Genre; children: GenreOption[] };
export type Filters = {
  q: string;
  place: string;
  from: string;
  to: string;
  countries: string[];
  genres: string[];
  durationMin: number | null;
  durationMax: number | null;
  sizes: SizeBand[];
};
export const emptyFilters = (): Filters => ({
  q: "",
  place: "",
  from: "",
  to: "",
  countries: [],
  genres: [],
  durationMin: null,
  durationMax: null,
  sizes: [],
});
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function validDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}
const unique = (values: string[]) => [...new Set(values)].sort();
export function normalizeFilters(
  filters: Filters,
  knownGenres: Genre[],
): Filters {
  const errors: string[] = [];
  const genres = new Set(knownGenres.map((genre) => genre.slug));
  const clean = {
    ...filters,
    q: filters.q.trim().replace(/\s+/g, " "),
    place: filters.place.trim().replace(/\s+/g, " "),
    countries: unique(filters.countries.map((c) => c.toUpperCase())),
    genres: unique(filters.genres),
    sizes: unique(filters.sizes) as SizeBand[],
  };
  if (clean.q.length > 200 || clean.place.length > 200)
    errors.push("Search text is too long.");
  if (clean.countries.some((c) => !isAssignedCountryCode(c)))
    errors.push("Choose a valid country code.");
  if (clean.genres.some((g) => !genres.has(g)))
    errors.push("Choose a known music genre.");
  if (clean.sizes.some((s) => !sizeBands.includes(s)))
    errors.push("Choose a valid size band.");
  if (
    Boolean(clean.from) !== Boolean(clean.to) ||
    (clean.from &&
      (!validDate(clean.from) || !validDate(clean.to) || clean.from > clean.to))
  )
    errors.push("Enter a valid date range with From on or before To.");
  if (
    [clean.durationMin, clean.durationMax].some(
      (n) => n !== null && (!Number.isSafeInteger(n) || n < 1),
    ) ||
    (clean.durationMin !== null &&
      clean.durationMax !== null &&
      clean.durationMin > clean.durationMax)
  )
    errors.push("Enter positive duration bounds in order.");
  if (errors.length) throw new Error(errors.join(" "));
  return clean;
}
export function parseFilters(
  params: URLSearchParams,
  knownGenres: Genre[],
): Filters {
  const keys = ["q", "place", "from", "to", "durationMin", "durationMax"];
  for (const key of keys)
    if (params.getAll(key).length > 1)
      throw new Error(`Repeated ${key} filter.`);
  const number = (key: string) => {
    const value = params.get(key);
    if (value === null) return null;
    if (!/^[1-9]\d*$/.test(value)) throw new Error(`Invalid ${key} filter.`);
    return Number(value);
  };
  return normalizeFilters(
    {
      q: params.get("q") ?? "",
      place: params.get("place") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
      countries: params.getAll("country"),
      genres: params.getAll("genre"),
      durationMin: number("durationMin"),
      durationMax: number("durationMax"),
      sizes: params.getAll("size") as SizeBand[],
    },
    knownGenres,
  );
}
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.from) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  for (const country of filters.countries) params.append("country", country);
  if (filters.place) params.set("place", filters.place);
  for (const genre of filters.genres) params.append("genre", genre);
  if (filters.durationMin !== null)
    params.set("durationMin", String(filters.durationMin));
  if (filters.durationMax !== null)
    params.set("durationMax", String(filters.durationMax));
  for (const size of filters.sizes) params.append("size", size);
  return params;
}
export function localToday(timeZone: string | null, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}
export function durationDays(start: string, end: string): number {
  return (
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}
export function capacityBand(capacity: number | null): SizeBand | null {
  if (capacity === null || capacity <= 0) return null;
  if (capacity < 1000) return "lt-1000";
  if (capacity < 5000) return "1000-4999";
  if (capacity < 20000) return "5000-19999";
  if (capacity < 50000) return "20000-49999";
  return "gte-50000";
}
export function matchSummary(
  summary: DiscoverySummary,
  filters: Filters,
  genreTree: Genre[],
  now: Date,
): boolean {
  const words = filters.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const names = [summary.eventName, summary.name, ...summary.aliases]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  if (words.some((word) => !names.includes(word))) return false;
  if (
    filters.from
      ? summary.startsOn > filters.to || summary.endsOn < filters.from
      : summary.endsOn < localToday(summary.timeZone, now)
  )
    return false;
  if (
    filters.countries.length &&
    !filters.countries.includes(summary.countryCode)
  )
    return false;
  const place = [summary.locality, summary.administrativeArea]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  if (filters.place && !place.includes(filters.place.toLocaleLowerCase()))
    return false;
  if (filters.genres.length) {
    const parent = new Map(
      genreTree.map((genre) => [genre.slug, genre.parentSlug]),
    );
    if (
      !summary.genres.some((genre) => {
        let slug: string | null = genre;
        const seen = new Set<string>();
        while (slug && !seen.has(slug)) {
          if (filters.genres.includes(slug)) return true;
          seen.add(slug);
          slug = parent.get(slug) ?? null;
        }
        return false;
      })
    )
      return false;
  }
  const duration = durationDays(summary.startsOn, summary.endsOn);
  if (filters.durationMin !== null && duration < filters.durationMin)
    return false;
  if (filters.durationMax !== null && duration > filters.durationMax)
    return false;
  if (
    filters.sizes.length &&
    !filters.sizes.includes(capacityBand(summary.capacityEstimate) as SizeBand)
  )
    return false;
  return true;
}
export function filterSummaries(
  summaries: DiscoverySummary[],
  filters: Filters,
  genres: Genre[],
  now: Date,
): DiscoverySummary[] {
  return summaries
    .filter((s) => matchSummary(s, filters, genres, now))
    .sort(
      (a, b) =>
        a.startsOn.localeCompare(b.startsOn) ||
        a.eventName.localeCompare(b.eventName, "en") ||
        a.id.localeCompare(b.id),
    );
}

export function genrePickerTree(
  summaries: DiscoverySummary[],
  knownGenres: Genre[],
  selected: string[],
): GenreOption[] {
  const bySlug = new Map(knownGenres.map((genre) => [genre.slug, genre]));
  const included = new Set([
    ...selected,
    ...summaries.flatMap((summary) => summary.genres),
  ]);
  for (const slug of [...included]) {
    let current = bySlug.get(slug);
    const seen = new Set<string>();
    while (current?.parentSlug && !seen.has(current.slug)) {
      seen.add(current.slug);
      included.add(current.parentSlug);
      current = bySlug.get(current.parentSlug);
    }
  }
  const nodes = new Map<string, GenreOption>();
  for (const slug of included) {
    const genre = bySlug.get(slug);
    if (genre) nodes.set(slug, { genre, children: [] });
  }
  const roots: GenreOption[] = [];
  for (const node of nodes.values()) {
    const parent = node.genre.parentSlug && nodes.get(node.genre.parentSlug);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (options: GenreOption[]) => {
    options.sort(
      (a, b) =>
        a.genre.name.localeCompare(b.genre.name, "en") ||
        a.genre.slug.localeCompare(b.genre.slug),
    );
    for (const option of options) sort(option.children);
  };
  sort(roots);
  return roots;
}
