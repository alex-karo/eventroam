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
