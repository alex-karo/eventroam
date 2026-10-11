import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";
import {
  filterSummaries,
  normalizeFilters,
  normalizeSearchText,
  searchTextLimit,
  type Filters,
  type SizeBand,
} from "./discovery";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string): string {
  return countryNames.of(code) ?? code;
}
export const sizeLabels: Record<SizeBand, string> = {
  "lt-1000": "Under 1,000",
  "1000-4999": "1,000–4,999",
  "5000-19999": "5,000–19,999",
  "20000-49999": "20,000–49,999",
  "gte-50000": "50,000+",
};
type SelectionField =
  "q" | "place" | "date" | "duration" | "countries" | "genres" | "sizes";
export type FilterSelection = {
  key: string;
  field: SelectionField;
  value: string;
  label: string;
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
function durationLabel(min: number | null, max: number | null): string {
  if (min === max) {
    return `${min} ${min === 1 ? "day" : "days"}`;
  }
  if (max === null) {
    return `${min} or more days`;
  }
  if (min === null) {
    return `Up to ${max} ${max === 1 ? "day" : "days"}`;
  }
  return `${min}–${max} days`;
}
export function filterSelections(
  filters: Filters,
  genres: Genre[],
): FilterSelection[] {
  const selections: FilterSelection[] = [];
  const add = (field: SelectionField, value: string, label = value) => {
    selections.push({ key: `${field}:${value}`, field, value, label });
  };
  if (filters.q) {
    add("q", filters.q);
  }
  if (filters.from) {
    add(
      "date",
      "range",
      `${dateLabel(filters.from)} – ${dateLabel(filters.to)}`,
    );
  }
  for (const code of filters.countries) {
    add("countries", code, countryName(code));
  }
  if (filters.place) {
    add("place", filters.place);
  }
  for (const slug of filters.genres) {
    add(
      "genres",
      slug,
      genres.find((genre) => genre.slug === slug)?.name ?? slug,
    );
  }
  if (filters.durationMin !== null || filters.durationMax !== null) {
    add(
      "duration",
      "range",
      durationLabel(filters.durationMin, filters.durationMax),
    );
  }
  for (const band of filters.sizes) {
    add("sizes", band, sizeLabels[band]);
  }
  return selections;
}
export function removeSelection(
  filters: Filters,
  selection: FilterSelection,
): Filters {
  const { field, value } = selection;
  switch (field) {
    case "date":
      return { ...filters, from: "", to: "" };
    case "duration":
      return { ...filters, durationMin: null, durationMax: null };
    case "q":
    case "place":
      return { ...filters, [field]: "" };
    case "countries":
      return {
        ...filters,
        countries: filters.countries.filter((item) => item !== value),
      };
    case "genres":
      return {
        ...filters,
        genres: filters.genres.filter((item) => item !== value),
      };
    case "sizes":
      return {
        ...filters,
        sizes: filters.sizes.filter((item) => item !== value),
      };
  }
}
export function previewFilters(
  summaries: DiscoverySummary[],
  pending: Filters,
  genres: Genre[],
  now: Date,
): { count: number; error: null } | { count: null; error: string } {
  try {
    const valid = normalizeFilters(pending, genres);
    return {
      count: filterSummaries(summaries, valid, genres, now).length,
      error: null,
    };
  } catch (caught) {
    return {
      count: null,
      error: caught instanceof Error ? caught.message : "Invalid filters.",
    };
  }
}
export function countryChoices(
  codes: string[],
  selected: string[],
  search: string,
) {
  const query = search.trim().toLowerCase();
  return [...new Set([...codes, ...selected])]
    .map((code) => ({ code, name: countryName(code) }))
    .filter(
      ({ code, name }) =>
        selected.includes(code) ||
        code.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query),
    )
    .sort(
      (a, b) =>
        Number(selected.includes(b.code)) - Number(selected.includes(a.code)) ||
        a.name.localeCompare(b.name, "en") ||
        a.code.localeCompare(b.code),
    );
}
export type PlaceSuggestion = { key: string; place: string; country: string };
export function placeSuggestions(
  summaries: DiscoverySummary[],
  countries: string[],
  text: string,
): PlaceSuggestion[] {
  const query = normalizeSearchText(text).toLowerCase();
  if (!query) {
    return [];
  }
  const unique = new Map<string, PlaceSuggestion>();
  for (const summary of summaries) {
    if (countries.length && !countries.includes(summary.countryCode)) {
      continue;
    }
    for (const raw of [summary.locality, summary.administrativeArea]) {
      const place = normalizeSearchText(raw ?? "");
      if (
        !place ||
        place.length > searchTextLimit ||
        !place.toLowerCase().includes(query)
      ) {
        continue;
      }
      const key = `${summary.countryCode}:${place.toLowerCase()}`;
      const existing = unique.get(key);
      if (!existing || place.localeCompare(existing.place, "en") < 0) {
        unique.set(key, { key, place, country: summary.countryCode });
      }
    }
  }
  return [...unique.values()]
    .sort(
      (a, b) =>
        a.place.localeCompare(b.place, "en") ||
        a.country.localeCompare(b.country),
    )
    .slice(0, 10);
}
