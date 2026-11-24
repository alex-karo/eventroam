import { searchCount, readBeforeSearch } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  selectedEditionDates,
  returned,
} from "../../research";
import {
  harborEchoFixture,
  searchPage,
  officialSite,
  castlewellan,
  discovery,
} from "./fixture";

export const searchDateConflictCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-date-conflict",
    task: "Check search policy date conflict",
    scope: "current",
    savedWebsite: officialSite,
    year: 2027,
    place: castlewellan,
    sources: [
      searchPage(officialSite, "conflicting.md"),
      searchPage(
        "https://castlewellangrounds.co.uk/events/harbor-echo-2027",
        "venue.md",
      ),
    ],
    discoveries: discovery(
      "https://castlewellangrounds.co.uk/events/harbor-echo-2027",
      "Harbor Echo official programme",
      "Castlewellan, 23–30 January 2027.",
    ),
  }),
  evaluate(context) {
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
};
