import { expect, test } from "vitest";
import {
  capacityBand,
  durationDays,
  emptyFilters,
  filterSummaries,
  genrePickerTree,
  matchSummary,
  normalizeFilters,
  parseFilters,
  serializeFilters,
  validDate,
  type DiscoverySummary,
  type Genre,
} from "./discovery";
const now = new Date("2026-10-01T12:00:00Z");
const genres: Genre[] = [
  { slug: "electronic", name: "Electronic", parentSlug: null },
  { slug: "trance", name: "Trance", parentSlug: "electronic" },
  { slug: "psytrance", name: "Psytrance", parentSlug: "electronic" },
];
const base: DiscoverySummary = {
  id: "a",
  eventSlug: "field-days",
  eventName: "Field Days",
  aliases: ["Old Field Name"],
  name: "Field Days 2027",
  year: 2027,
  key: "2027",
  startsOn: "2027-07-01",
  endsOn: "2027-07-03",
  dateState: "provisional",
  status: "scheduled",
  ticketAvailability: "sold_out",
  countryCode: "PT",
  locality: "Example Valley",
  administrativeArea: null,
  venueName: null,
  latitude: null,
  longitude: null,
  coordinatePrecision: "unknown",
  timeZone: "Europe/Lisbon",
  capacityEstimate: 5000,
  genres: ["psytrance"],
};
test("date validation, inclusive overlap, leap boundaries, and duration", () => {
  expect(validDate("2028-02-29")).toBe(true);
  expect(validDate("2027-02-29")).toBe(false);
  expect(durationDays("2028-02-28", "2028-03-01")).toBe(3);
  expect(
    matchSummary(
      base,
      { ...emptyFilters(), from: "2027-07-03", to: "2027-07-03" },
      genres,
      now,
    ),
  ).toBe(true);
  expect(
    matchSummary(
      base,
      { ...emptyFilters(), from: "2027-07-04", to: "2027-07-04" },
      genres,
      now,
    ),
  ).toBe(false);
  expect(
    matchSummary(
      base,
      emptyFilters(),
      genres,
      new Date("2028-01-01T00:00:00Z"),
    ),
  ).toBe(false);
});

test("genre picker uses eligible inventory, groups descendants, and retains selected zero-result terms", () => {
  const vocabulary: Genre[] = [
    { slug: "drum-and-bass", name: "Drum & bass", parentSlug: "electronic" },
    { slug: "jazz", name: "Jazz", parentSlug: null },
    { slug: "rock", name: "Rock", parentSlug: null },
    { slug: "psytrance", name: "Psytrance", parentSlug: "electronic" },
    { slug: "electronic", name: "Electronic", parentSlug: null },
  ];
  const inventory = [
    { ...base, genres: ["psytrance"] },
    { ...base, id: "rock", genres: ["rock"] },
  ];
  const tree = genrePickerTree(inventory, vocabulary, []);
  expect(tree.map((node) => node.genre.slug)).toEqual(["electronic", "rock"]);
  expect(tree[0].children.map((node) => node.genre.slug)).toEqual([
    "psytrance",
  ]);
  expect(
    genrePickerTree(inventory, vocabulary, ["jazz"]).map(
      (node) => node.genre.slug,
    ),
  ).toEqual(["electronic", "jazz", "rock"]);
  expect(
    genrePickerTree(inventory, vocabulary, ["drum-and-bass"])[0].children.map(
      (node) => node.genre.slug,
    ),
  ).toEqual(["drum-and-bass", "psytrance"]);
});
test("genre ancestry, aliases, AND across groups, OR within groups, unknowns", () => {
  const filters = {
    ...emptyFilters(),
    q: "old field",
    countries: ["DE", "PT"],
    genres: ["electronic"],
    sizes: ["5000-19999" as const],
    durationMin: 3,
    durationMax: 3,
    place: "valley",
  };
  expect(matchSummary(base, filters, genres, now)).toBe(true);
  expect(
    matchSummary(base, { ...filters, genres: ["trance"] }, genres, now),
  ).toBe(false);
  expect(
    matchSummary(base, { ...filters, countries: ["DE"] }, genres, now),
  ).toBe(false);
  expect(
    matchSummary({ ...base, capacityEstimate: null }, filters, genres, now),
  ).toBe(false);
  expect(
    matchSummary(
      { ...base, capacityEstimate: null, genres: [] },
      emptyFilters(),
      genres,
      now,
    ),
  ).toBe(true);
  expect(capacityBand(999)).toBe("lt-1000");
  expect(capacityBand(1000)).toBe("1000-4999");
  expect(capacityBand(4999)).toBe("1000-4999");
  expect(capacityBand(5000)).toBe("5000-19999");
  expect(capacityBand(19999)).toBe("5000-19999");
  expect(capacityBand(20000)).toBe("20000-49999");
  expect(capacityBand(49999)).toBe("20000-49999");
  expect(capacityBand(50000)).toBe("gte-50000");
});
test("matching stays on one edition and ordering is stable", () => {
  const other = {
    ...base,
    id: "b",
    startsOn: "2027-08-01",
    endsOn: "2027-08-02",
    genres: [],
    capacityEstimate: null,
  };
  const filters = {
    ...emptyFilters(),
    from: "2027-08-01",
    to: "2027-08-02",
    genres: ["electronic"],
  };
  expect(filterSummaries([base, other], filters, genres, now)).toEqual([]);
  expect(
    filterSummaries(
      [
        { ...base, id: "z" },
        { ...base, id: "a" },
      ],
      emptyFilters(),
      genres,
      now,
    ).map((s) => s.id),
  ).toEqual(["a", "z"]);
});
test("URL round trip, normalization, invalid bounds, unrelated and bbox", () => {
  const raw = new URLSearchParams(
    "genre=psytrance&country=pt&country=PT&q=%20Field%20%20Days%20&bbox=1,2,3,4&view=map",
  );
  const parsed = parseFilters(raw, genres);
  expect(serializeFilters(parsed).toString()).toBe(
    "q=Field+Days&country=PT&genre=psytrance",
  );
  expect(parseFilters(serializeFilters(parsed), genres)).toEqual(parsed);
  expect(() =>
    parseFilters(new URLSearchParams("from=2027-02-29&to=2027-03-01"), genres),
  ).toThrow();
  expect(() =>
    normalizeFilters(
      { ...emptyFilters(), durationMin: 4, durationMax: 3 },
      genres,
    ),
  ).toThrow();
  expect(() =>
    parseFilters(new URLSearchParams("size=unknown"), genres),
  ).toThrow();
});
