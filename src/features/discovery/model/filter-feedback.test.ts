import { expect, test } from "vitest";
import { testFixtures } from "@/test/fixtures";
import {
  emptyFilters,
  type Filters,
} from "@/features/discovery/model/discovery";
import {
  countryChoices,
  countryName,
  filterSelections,
  placeSuggestions,
  previewFilters,
  removeSelection,
} from "@/features/discovery/model/filter-feedback";
const { build } = testFixtures();
const genres = [
  { slug: "rock", name: "Rock", parentSlug: null },
  { slug: "jazz", name: "Jazz", parentSlug: null },
];
const now = new Date("2026-10-01T12:00:00Z");

test("chips show each value and removal preserves unrelated selections", () => {
  const filters: Filters = {
    ...emptyFilters(),
    q: "Field",
    place: "Lisbon",
    countries: ["ES", "PT"],
    genres: ["rock", "jazz"],
    sizes: ["lt-1000", "gte-50000"],
    from: "2027-08-01",
    to: "2027-08-31",
    durationMin: 4,
  };
  const chips = filterSelections(filters, genres);
  expect(chips.map((chip) => chip.label)).toEqual([
    "Field",
    "1 Aug 2027 – 31 Aug 2027",
    "Spain",
    "Portugal",
    "Lisbon",
    "Rock",
    "Jazz",
    "4 or more days",
    "Under 1,000",
    "50,000+",
  ]);
  for (const chip of chips) {
    const next = removeSelection(filters, chip);
    switch (chip.field) {
      case "countries":
        expect(next).toEqual({
          ...filters,
          countries: filters.countries.filter((value) => value !== chip.value),
        });
        break;
      case "genres":
        expect(next).toEqual({
          ...filters,
          genres: filters.genres.filter((value) => value !== chip.value),
        });
        break;
      case "sizes":
        expect(next).toEqual({
          ...filters,
          sizes: filters.sizes.filter((value) => value !== chip.value),
        });
        break;
      case "date":
        expect(next).toEqual({ ...filters, from: "", to: "" });
        break;
      case "duration":
        expect(next).toEqual({
          ...filters,
          durationMin: null,
          durationMax: null,
        });
        break;
      default:
        expect(next).toEqual({ ...filters, [chip.field]: "" });
    }
  }
  expect(filters.countries).toEqual(["ES", "PT"]);
  expect(
    filterSelections({ ...emptyFilters(), durationMax: 1 }, []).map(
      (chip) => chip.label,
    ),
  ).toEqual(["Up to 1 day"]);
  expect(
    filterSelections(
      { ...emptyFilters(), durationMin: 1, durationMax: 1 },
      [],
    )[0].label,
  ).toBe("1 day");
  expect(
    filterSelections(
      { ...emptyFilters(), durationMin: 2, durationMax: 3 },
      [],
    )[0].label,
  ).toBe("2–3 days");
});

test("preview counts total inventory with normalized matching, history and overlap", () => {
  const summaries = [
    build.summary({
      id: "mapped",
      eventName: "Field Days",
      locality: "Lisbon",
      latitude: 38,
      longitude: -9,
      startsOn: "2025-07-01",
      endsOn: "2025-07-03",
    }),
    build.summary({
      id: "unlocated",
      eventName: "Field Days",
      locality: "Lisbon",
      latitude: null,
      longitude: null,
      startsOn: "2025-07-02",
      endsOn: "2025-07-02",
    }),
    build.summary({
      id: "future",
      startsOn: "2027-07-01",
      endsOn: "2027-07-03",
    }),
  ];
  const pending = {
    ...emptyFilters(),
    q: " field  days ",
    place: " lisbon ",
    from: "2025-07-02",
    to: "2025-07-02",
  };
  expect(previewFilters(summaries, pending, [], now)).toEqual({
    count: 2,
    error: null,
  });
  expect(
    previewFilters(summaries, { ...pending, q: "unlisted" }, [], now),
  ).toEqual({ count: 0, error: null });
  expect(previewFilters(summaries, { ...pending, to: "" }, [], now)).toEqual({
    count: null,
    error: expect.stringContaining("date range"),
  });
  expect(
    previewFilters(
      summaries,
      { ...emptyFilters(), durationMin: 4, durationMax: 3 },
      [],
      now,
    ).error,
  ).toContain("duration bounds");
  expect(previewFilters(summaries, emptyFilters(), [], now).count).toBe(1);
  expect(
    previewFilters(
      [
        ...summaries,
        build.summary({ startsOn: "2027-07-01", endsOn: "2027-07-03" }),
      ],
      emptyFilters(),
      [],
      now,
    ).count,
  ).toBe(2);
});

test("country search matches names and codes and retains selected absent countries", () => {
  expect(countryName("PT")).toBe("Portugal");
  expect(
    countryChoices(["PT", "ES"], ["JP", "ES"], "pOrTugAL").map(
      (item) => item.code,
    ),
  ).toEqual(["JP", "ES", "PT"]);
  expect(
    countryChoices(["ES", "PT"], [], "pt").map((item) => item.name),
  ).toEqual(["Portugal"]);
  expect(countryChoices(["PT"], [], "missing")).toEqual([]);
});

test("suggestions include history, deduplicate per country, normalize and enforce search limit", () => {
  const summaries = [
    build.summary({
      countryCode: "PT",
      locality: "  Example   Valley ",
      administrativeArea: "Example Region",
      startsOn: "2020-01-01",
      endsOn: "2020-01-02",
    }),
    build.summary({
      countryCode: "PT",
      locality: "Example Valley",
      administrativeArea: null,
    }),
    build.summary({
      countryCode: "ES",
      locality: "Example Valley",
      administrativeArea: null,
    }),
    build.summary({
      countryCode: "PT",
      locality: "E".repeat(200),
      administrativeArea: "E".repeat(201),
    }),
    build.summary({ locality: null, administrativeArea: null }),
  ];
  expect(placeSuggestions(summaries, [], "example")).toEqual([
    { key: "PT:example region", place: "Example Region", country: "PT" },
    { key: "ES:example valley", place: "Example Valley", country: "ES" },
    { key: "PT:example valley", place: "Example Valley", country: "PT" },
  ]);
  expect(
    placeSuggestions(summaries, ["PT"], "  EXAMPLE   valley "),
  ).toHaveLength(1);
  expect(
    placeSuggestions(summaries, [], "ee").map((item) => item.place.length),
  ).toEqual([200]);
  expect(placeSuggestions(summaries, [], " ")).toEqual([]);
  expect(placeSuggestions([...summaries].reverse(), [], "example")).toEqual(
    placeSuggestions(summaries, [], "example"),
  );
  expect(
    placeSuggestions(
      Array.from({ length: 20 }, (_, index) =>
        build.summary({ locality: `Town ${index}`, administrativeArea: null }),
      ),
      [],
      "town",
    ),
  ).toHaveLength(10);
});
