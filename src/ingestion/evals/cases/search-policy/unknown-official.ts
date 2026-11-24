import { officialWebsite } from "../../changes";
import { searchCount, readBeforeSearch } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { researchStatus, editionSlots } from "../../research";
import {
  harborEchoFixture,
  searchPage,
  officialSite,
  castlewellan,
  noPreviousEditionNote,
  programmeUrl,
  programmeDiscovery,
} from "./fixture";

export const searchUnknownOfficialCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-unknown-official",
    task: "Check search policy unknown official",
    scope: "full",
    savedWebsite: null,
    year: 2027,
    place: castlewellan,
    note: noPreviousEditionNote,
    sources: [
      searchPage(officialSite, "official.md"),
      searchPage(programmeUrl, "official.md"),
    ],
    discoveries: programmeDiscovery,
  }),
  evaluate(context) {
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
};
