import { searchCount } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { researchStatus, editionSlots } from "../../research";
import {
  harborEchoFixture,
  searchPage,
  officialSite,
  castlewellan,
} from "./fixture";

export const searchNoAnnouncementCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-no-announcement",
    task: "Check search policy no announcement",
    scope: "full",
    savedWebsite: officialSite,
    year: 2026,
    place: castlewellan,
    sources: [searchPage(officialSite, "completed.md")],
  }),
  evaluate(context) {
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
};
