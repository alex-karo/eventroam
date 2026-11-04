import { expect, test } from "vitest";
import { festivalEditionRules } from "./festival-edition-publication";

const published = {
  startsOn: "2027-06-01",
  endsOn: "2027-06-02",
  dateState: "confirmed",

  publicationState: "published",
  editionYear: 2027,
  countryCode: "PT",
  locality: "Lisbon",
};

test.each([
  { ...published, editionYear: null },
  { ...published, countryCode: null },
  { ...published, startsOn: null, endsOn: null, dateState: "unknown" },
])("inconsistent edition is rejected: %j", (record) => {
  expect(() => festivalEditionRules.validateRecord(record)).toThrow();
});

test("published editions need only a country for location", () => {
  festivalEditionRules.validateRecord({ ...published, locality: null });
  for (const field of ["venueName", "locality", "administrativeArea"]) {
    festivalEditionRules.validateRecord({
      ...published,
      locality: null,
      [field]: "Known area",
    });
  }
});

test.each(["topic", "culture"])(
  "publication accepts arbitrary values with a %s theme",
  (theme) => {
    const terms = ["event_type", theme].map((facet) => ({
      facet,
      slug: "another-valid-value",
    }));
    expect(() => festivalEditionRules.validateFacets(terms)).not.toThrow();
    expect(() =>
      festivalEditionRules.validateFacets([...terms, { facet: "format" }]),
    ).not.toThrow();
    for (const missing of ["event_type", theme]) {
      expect(() =>
        festivalEditionRules.validateFacets(
          terms.filter((term) => term.facet !== missing),
        ),
      ).toThrow(/requires/);
    }
  },
);

test("publication checks retain their messages and order", () => {
  expect(() =>
    festivalEditionRules.validateRecord({
      publicationState: "published",
      latitude: 38,
    }),
  ).toThrow("Coordinate pair is incomplete");
  expect(() =>
    festivalEditionRules.validateRecord({ publicationState: "published" }),
  ).toThrow("Publication needs supported dates and year");
  expect(() =>
    festivalEditionRules.validateRecord({
      ...published,
      countryCode: null,
      priceKind: "free",
    }),
  ).toThrow("Publication needs country");
  expect(() => festivalEditionRules.validateFacets([])).toThrow(
    "Festival scope requires event type",
  );
  expect(() =>
    festivalEditionRules.validateFacets([{ facet: "event_type" }]),
  ).toThrow("Festival scope requires topic or culture");
});
