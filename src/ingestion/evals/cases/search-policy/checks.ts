import { officialWebsite } from "../../changes";
import { searchCount, readBeforeSearch } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  selectedEditionDates,
  returned,
} from "../../research";

export const checks = {
  "search-concrete-place": (context) => [
    ...editionSlots(context, null, "2027"),
    researchStatus(context, "success"),
    check(
      "toolUse.placeSearch",
      searchCount(context.calls) >= 1,
      "Search for the festival place despite a known country",
    ),
    readBeforeSearch(
      context.calls,
      "https://harborechofestival.co.uk/visitor-guide",
      2,
    ),
    check(
      "toolUse.readPlace",
      context.calls.some(
        (call) =>
          call.tool === "readPage" &&
          call.url === "https://harborechofestival.co.uk/visitor-guide",
      ),
      "Inspect the discovered visitor guide",
    ),
    check(
      "catalog.edition.2027.venue",
      context.changes.edition(
        { key: "2027" },
        "venue_name",
        (value) => value === "Castlewellan Grounds",
      ),
      "Set the source-supported festival venue",
    ),
    check(
      "catalog.edition.2027.locality",
      context.changes.edition(
        { key: "2027" },
        "locality",
        (value) => value === "Castlewellan",
      ),
      "Set the source-supported locality",
    ),
  ],
  "search-withheld-place": (context) => [
    ...editionSlots(context, null, "2027"),
    researchStatus(context, "success"),
    check(
      "toolUse.noPlaceSearch",
      searchCount(context.calls) === 0,
      "Do not search for a venue explicitly withheld by the organizer",
    ),
    check(
      "catalog.edition.2027.noOfficeVenue",
      !context.changes.edition(
        { key: "2027" },
        "venue_name",
        (value) => value != null,
      ),
      "Do not use the organizer office as the festival venue",
    ),
  ],
  "search-no-announcement": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "2026", null),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 0,
        "searches <= 0",
      ),
    ];
  },
  "search-no-optional-field": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 0,
        "searches <= 0",
      ),
    ];
  },
  "search-unknown-official": (context) => {
    const { changes } = context;
    return [
      officialWebsite(changes, ["https://harborechofestival.co.uk/"]),
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      check(
        "toolUse.minSearches",
        searchCount(context.calls) >= 1,
        "searches >= 1",
      ),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 1,
        "searches <= 1",
      ),
      readBeforeSearch(
        context.calls,
        "https://harborechofestival.co.uk/programme",
        2,
      ),
    ];
  },
  "search-inaccessible-official": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      check(
        "toolUse.minSearches",
        searchCount(context.calls) >= 1,
        "searches >= 1",
      ),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 1,
        "searches <= 1",
      ),
      readBeforeSearch(
        context.calls,
        "https://harborechofestival.co.uk/programme",
        2,
      ),
    ];
  },
  "search-wrong-official": (context) => {
    const { changes } = context;
    return [
      officialWebsite(changes, ["https://harborechofestival.co.uk/"]),
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      check(
        "toolUse.minSearches",
        searchCount(context.calls) >= 1,
        "searches >= 1",
      ),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 1,
        "searches <= 1",
      ),
      readBeforeSearch(
        context.calls,
        "https://harborechofestival.co.uk/programme",
        2,
      ),
    ];
  },
  "search-date-conflict": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.dates", selectedEditionDates(context, "2027"), {
        startsOn: "2027-01-23",
        endsOn: "2027-01-30",
      }),
      check(
        "toolUse.minSearches",
        searchCount(context.calls) >= 1,
        "searches >= 1",
      ),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 1,
        "searches <= 1",
      ),
      readBeforeSearch(
        context.calls,
        "https://castlewellangrounds.co.uk/events/harbor-echo-2027",
        2,
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
