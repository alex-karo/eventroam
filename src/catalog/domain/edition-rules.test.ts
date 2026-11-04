import { expect, test } from "vitest";
import { defineEditionRules } from "./edition-rules";
import { festivalEditionRules } from "./festival-edition-publication";
import {
  publicationStates,
  dateStates,
  scheduleStatuses,
  coordinatePrecisions,
} from "./vocabulary";

const dated = {
  startsOn: "2027-06-01",
  endsOn: "2027-06-02",
  dateState: "confirmed",
};

test("all supported edition statuses and precisions remain valid", () => {
  for (const scheduleStatus of scheduleStatuses) {
    festivalEditionRules.validateRecord({ ...dated, scheduleStatus });
  }
  for (const dateState of dateStates) {
    festivalEditionRules.validateRecord(
      dateState === "unknown" ? { dateState } : { ...dated, dateState },
    );
  }
  for (const coordinatePrecision of coordinatePrecisions) {
    festivalEditionRules.validateRecord(
      coordinatePrecision === "unknown"
        ? { coordinatePrecision }
        : { coordinatePrecision, latitude: 38, longitude: -9 },
    );
  }
  for (const publicationState of publicationStates) {
    festivalEditionRules.validateRecord({
      ...dated,
      editionYear: 2027,
      countryCode: "PT",
      publicationState,
    });
  }
  festivalEditionRules.validateRecord({
    startsOn: null,
    endsOn: null,
    latitude: null,
    longitude: null,
  });
  festivalEditionRules.validateRecord({
    startsOn: undefined,
    dateState: undefined,
  });
});

test.each([
  "publicationState",
  "scheduleStatus",
  "dateState",
  "coordinatePrecision",
])("%s rejects unknown values and explicit null", (field) => {
  for (const value of ["future", null]) {
    expect(() =>
      festivalEditionRules.validateRecord({ [field]: value }),
    ).toThrow();
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
])("inconsistent edition is rejected: %j", (record) => {
  expect(() => festivalEditionRules.validateRecord(record)).toThrow();
});

test("one policy selects both the required fields and the required facets", () => {
  const rules = defineEditionRules({
    requiredFields: [{ field: "timeZone", message: "Missing time zone" }],
    requiredFacetGroups: [{ anyOf: ["format"], message: "Missing format" }],
  });
  const row = { timeZone: "UTC" };
  const terms = [{ facet: "format" }];
  expect(rules.isPublishable(row, terms)).toBe(true);
  expect(rules.isPublishable({}, terms)).toBe(false);
  expect(rules.isPublishable(row, [])).toBe(false);
  expect(rules.isPublishable({ ...row, latitude: 42 }, terms)).toBe(false);
});
