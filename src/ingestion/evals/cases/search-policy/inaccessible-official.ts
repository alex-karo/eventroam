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

export const searchInaccessibleOfficialCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-inaccessible-official",
    task: "Check search policy inaccessible official",
    scope: "full",
    savedWebsite: officialSite,
    year: 2027,
    place: castlewellan,
    note: noPreviousEditionNote,
    sources: [
      searchPage(officialSite, "blocked.md", {
        status: "failed",
        reasonCode: "http_403",
      }),
      searchPage(programmeUrl, "official.md"),
    ],
    discoveries: programmeDiscovery,
  }),
  evaluate(context) {
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
};
