import { expect, test } from "vitest";
import { testFixtures } from "../test/fixtures";

const { build } = testFixtures();
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
  type Genre,
} from "./discovery";

test("date validation, inclusive overlap, leap boundaries, and duration", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const summary = build.summary({
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
  });
  expect(validDate("2028-02-29")).toBe(true);
  expect(validDate("2027-02-29")).toBe(false);
  expect(durationDays("2028-02-28", "2028-03-01")).toBe(3);
  expect(
    matchSummary(
      summary,
      { ...emptyFilters(), from: "2027-07-03", to: "2027-07-03" },
      [],
      now,
    ),
  ).toBe(true);
  expect(
    matchSummary(
      summary,
      { ...emptyFilters(), from: "2027-07-04", to: "2027-07-04" },
      [],
      now,
    ),
  ).toBe(false);
  expect(
    matchSummary(summary, emptyFilters(), [], new Date("2028-01-01T00:00:00Z")),
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
    build.summary({ id: "psytrance", genres: ["psytrance"] }),
    build.summary({ id: "rock", genres: ["rock"] }),
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
  const now = new Date("2026-10-01T12:00:00Z");
  const genres: Genre[] = [
    { slug: "electronic", name: "Electronic", parentSlug: null },
    { slug: "trance", name: "Trance", parentSlug: "electronic" },
    { slug: "psytrance", name: "Psytrance", parentSlug: "electronic" },
  ];
  const summary = build.summary({
    aliases: ["Old Field Name"],
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
    countryCode: "PT",
    locality: "Example Valley",
    capacityEstimate: 5000,
    genres: ["psytrance"],
  });
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
  expect(matchSummary(summary, filters, genres, now)).toBe(true);
  expect(
    matchSummary(summary, { ...filters, genres: ["trance"] }, genres, now),
  ).toBe(false);
  expect(
    matchSummary(summary, { ...filters, countries: ["DE"] }, genres, now),
  ).toBe(false);
  expect(
    matchSummary({ ...summary, capacityEstimate: null }, filters, genres, now),
  ).toBe(false);
  expect(
    matchSummary(
      { ...summary, capacityEstimate: null, genres: [] },
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
  const now = new Date("2026-10-01T12:00:00Z");
  const genres: Genre[] = [
    { slug: "electronic", name: "Electronic", parentSlug: null },
    { slug: "psytrance", name: "Psytrance", parentSlug: "electronic" },
  ];
  const base = build.summary({
    id: "a",
    genres: ["psytrance"],
    startsOn: "2027-07-01",
  });
  const other = build.summary({
    id: "b",
    startsOn: "2027-08-01",
    endsOn: "2027-08-02",
    genres: [],
  });
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
  const genres: Genre[] = [
    { slug: "psytrance", name: "Psytrance", parentSlug: null },
  ];
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
