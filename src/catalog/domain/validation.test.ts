import { expect, test } from "vitest";
import {
  validateEventRecord,
  validateOccurrenceRecord,
  validateStoredPrice,
  validateSourceRecord,
  validateLinkRecord,
  validateAliasRecord,
  validateTaxonomyTerm,
  validateTermAssignments,
} from "./validation";
import {
  publicationStates,
  dateStates,
  scheduleStatuses,
  ticketAvailabilities,
  coordinatePrecisions,
  sourceKinds,
  sourceAuthorities,
  linkKinds,
  facets,
} from "./vocabulary";

const dated = {
  startsOn: "2027-06-01",
  endsOn: "2027-06-02",
  dateState: "confirmed",
};
const published = {
  ...dated,
  publicationState: "published",
  occurrenceYear: 2027,
  countryCode: "PT",
  locality: "Lisbon",
};
const paid = {
  priceKind: "exact",
  priceCurrency: "EUR",
  priceMinMinor: 100,
  priceMaxMinor: 100,
  priceCoverage: "full_programme",
};

test("event defaults, lifecycle and home scope", () => {
  expect(() => validateEventRecord({})).not.toThrow();
  for (const publicationState of publicationStates) {
    expect(() =>
      validateEventRecord({ publicationState, homeScope: "festivals" }),
    ).not.toThrow();
  }
  for (const record of [
    { publicationState: "future" },
    { publicationState: null },
    { homeScope: "conferences" },
    { publicationState: "published" },
    { publicationState: "published", homeScope: null },
  ]) {
    expect(() => validateEventRecord(record)).toThrow();
  }
});

test("all supported occurrence statuses and precisions remain valid", () => {
  for (const ticketAvailability of ticketAvailabilities) {
    validateOccurrenceRecord({ ticketAvailability });
  }
  for (const scheduleStatus of scheduleStatuses) {
    validateOccurrenceRecord({ ...dated, scheduleStatus });
  }
  for (const dateState of dateStates) {
    validateOccurrenceRecord(
      dateState === "unknown" ? { dateState } : { ...dated, dateState },
    );
  }
  for (const coordinatePrecision of coordinatePrecisions) {
    validateOccurrenceRecord(
      coordinatePrecision === "unknown"
        ? { coordinatePrecision }
        : { coordinatePrecision, latitude: 38, longitude: -9 },
    );
  }
  for (const publicationState of publicationStates) {
    validateOccurrenceRecord({ ...published, publicationState });
  }
  validateOccurrenceRecord({
    startsOn: null,
    endsOn: null,
    latitude: null,
    longitude: null,
  });
  validateOccurrenceRecord({ startsOn: undefined, dateState: undefined });
});

test.each([
  "publicationState",
  "ticketAvailability",
  "scheduleStatus",
  "dateState",
  "coordinatePrecision",
])("%s rejects unknown values and explicit null", (field) => {
  for (const value of ["future", null]) {
    expect(() => validateOccurrenceRecord({ [field]: value })).toThrow();
  }
});

test.each([
  { ...dated, dateState: "unknown" },
  { dateState: "confirmed" },
  { scheduleStatus: "scheduled" },
  { startsOn: "2027-01-01" },
  { ...dated, endsOn: "2027-05-01" },
  { coordinatePrecision: "exact" },
  { latitude: 38, longitude: -9 },
  { latitude: 38, coordinatePrecision: "exact" },
  { latitude: 91, longitude: 0, coordinatePrecision: "exact" },
  { ...published, occurrenceYear: null },
  { ...published, countryCode: null },
  { ...published, locality: null },
])("inconsistent occurrence is rejected: %j", (record) => {
  expect(() => validateOccurrenceRecord(record)).toThrow();
});

test("published occurrences can use a venue, locality or region", () => {
  for (const field of ["venueName", "locality", "administrativeArea"]) {
    validateOccurrenceRecord({
      ...published,
      locality: null,
      [field]: "Known area",
    });
  }
});

test("price variants preserve the existing complete-block contract", () => {
  validateStoredPrice({});
  validateStoredPrice({ priceKind: null, priceQualification: null });
  validateStoredPrice(paid);
  validateStoredPrice({ ...paid, priceKind: "from", priceCoverage: "day" });
  validateStoredPrice({
    ...paid,
    priceKind: "range",
    priceMaxMinor: 200,
    priceCoverage: "package",
  });
  validateStoredPrice({
    priceKind: "free",
    priceMinMinor: 0,
    priceMaxMinor: 0,
    priceCoverage: "full_programme",
    priceCurrency: null,
    priceQualification: "x".repeat(500),
  });
});

test.each([
  { priceCurrency: "EUR" },
  { priceQualification: "stray" },
  { ...paid, priceKind: null },
  { ...paid, priceCoverage: null },
  { ...paid, priceKind: "future" },
  { ...paid, priceKind: "range" },
  { ...paid, priceMaxMinor: 200 },
  { ...paid, priceMinMinor: -1 },
  { ...paid, priceMinMinor: 1.5 },
  { ...paid, priceMaxMinor: null },
  { ...paid, priceCurrency: "eur" },
  { ...paid, priceCurrency: "EU" },
  { ...paid, priceCoverage: "future" },
  { ...paid, priceQualification: "x".repeat(501) },
  { ...paid, priceKind: "free", priceMinMinor: 0, priceMaxMinor: 0 },
  {
    priceKind: "free",
    priceCurrency: null,
    priceMinMinor: null,
    priceMaxMinor: 0,
    priceCoverage: "full_programme",
  },
  {
    priceKind: "free",
    priceMinMinor: 0,
    priceMaxMinor: 0,
    priceCoverage: "day",
  },
])("invalid stored price is rejected: %j", (record) => {
  expect(() => validateStoredPrice(record)).toThrow();
});

test("source, link, alias and facet vocabularies are runtime checked", () => {
  for (const kind of sourceKinds) {
    validateSourceRecord({ kind, authority: "official" });
  }
  for (const authority of sourceAuthorities) {
    validateSourceRecord({ kind: "website", authority });
  }
  for (const kind of linkKinds) {
    validateLinkRecord({ kind });
  }
  expect(linkKinds).toContain("x");
  expect(() => validateLinkRecord({ kind: "twitter" })).toThrow();
  validateAliasRecord({ scope: "festivals" });
  for (const facet of facets) {
    validateTaxonomyTerm({ id: "term", facet });
  }
  for (const value of ["future", null, undefined]) {
    expect(() =>
      validateSourceRecord({ kind: value, authority: "official" }),
    ).toThrow();
    expect(() =>
      validateSourceRecord({ kind: "website", authority: value }),
    ).toThrow();
    expect(() => validateLinkRecord({ kind: value })).toThrow();
    expect(() => validateAliasRecord({ scope: value })).toThrow();
  }
  expect(() => validateTaxonomyTerm({ id: "term", facet: "future" })).toThrow();
});

test("taxonomy validates both sides of an edited parent relation", () => {
  const parent = { id: "parent", facet: "genre" };
  const child = { id: "child", facet: "genre", parentId: "parent" };
  validateTaxonomyTerm(child, parent);
  validateTaxonomyTerm(parent, undefined, [child]);
  expect(() => validateTaxonomyTerm(child)).toThrow(/parent/);
  expect(() =>
    validateTaxonomyTerm({ ...child, facet: "topic" }, parent),
  ).toThrow(/same facet/);
  expect(() =>
    validateTaxonomyTerm({ ...parent, facet: "topic" }, undefined, [child]),
  ).toThrow(/same facet/);
});

test.each(["event_type", "format"])(
  "only one %s assignment is allowed",
  (facet) => {
    validateTermAssignments([{ id: "one", facet }]);
    expect(() =>
      validateTermAssignments([
        { id: "one", facet },
        { id: "two", facet },
      ]),
    ).toThrow(/Only one/);
  },
);
test("multiple topic, genre and culture assignments remain allowed", () => {
  validateTermAssignments(
    ["topic", "genre", "culture"].flatMap((facet) => [
      { id: `${facet}-1`, facet },
      { id: `${facet}-2`, facet },
    ]),
  );
});
