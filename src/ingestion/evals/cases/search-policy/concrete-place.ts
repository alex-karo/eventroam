import { searchCount } from "../../tool-use";
import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { researchStatus, editionSlots } from "../../research";
import {
  harborEchoFixture,
  searchPage,
  officialSite,
  discovery,
} from "./fixture";

export const searchConcretePlaceCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: harborEchoFixture({
    id: "search-concrete-place",
    task: "Keep the festival Edition when only its country is known",
    scope: "current",
    savedWebsite: officialSite,
    year: 2027,
    note: "The official announcement names the country. A visitor guide with the venue is available only through search. No live source or search fallback.",
    sources: [
      searchPage(officialSite, "country-only.md"),
      searchPage(
        "https://harborechofestival.co.uk/visitor-guide",
        "concrete-place.md",
      ),
    ],
    discoveries: discovery(
      "https://harborechofestival.co.uk/visitor-guide",
      "Harbor Echo 2027 official visitor guide",
      "Festival venue and access information.",
    ),
  }),
  evaluate: (context) => [
    ...editionSlots(context, null, "2027"),
    researchStatus(context, "success"),
    check(
      "toolUse.noPlaceSearch",
      searchCount(context.calls) === 0,
      "Skip search when only place details are missing",
    ),
    check(
      "catalog.edition.2027.venue",
      !context.changes.edition(
        { key: "2027" },
        "venue_name",
        (value) => value != null,
      ),
      "Leave the unsupported venue empty",
    ),
    check(
      "catalog.edition.2027.locality",
      !context.changes.edition(
        { key: "2027" },
        "locality",
        (value) => value != null,
      ),
      "Leave the unsupported locality empty",
    ),
  ],
};
