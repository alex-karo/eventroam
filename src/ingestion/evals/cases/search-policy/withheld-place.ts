import { searchCount } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { researchStatus, editionSlots } from "../../research";
import { harborEchoFixture, searchPage, officialSite } from "./fixture";

export const searchWithheldPlaceCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-withheld-place",
    task: "Check festival place withheld-place",
    scope: "current",
    savedWebsite: officialSite,
    year: 2027,
    note: "Synthetic place discovery with a known country. No live source or search fallback.",
    sources: [searchPage(officialSite, "withheld-place.md")],
  }),
  evaluate: (context) => [
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
};
