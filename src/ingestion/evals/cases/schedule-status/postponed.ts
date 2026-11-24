import { check } from "../../checks";
import { preserveDates } from "../../changes";
import type { RegressionCaseDefinition } from "../../regression";
import { editionSlots, researchDidNotFail } from "../../research";
import { searchCount } from "../../tool-use";
import { refreshInput } from "../fixture";

export const scheduleStatusPostponedCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "schedule-status-postponed",
    suite: "regression",
    origin: "synthetic",
    task: "Check schedule status for River Festival",
    todayUtc: "2026-11-14",
    provenance: {
      kind: "synthetic-schedule-status-regression",
      note: "Synthetic postponement notice with a complete saved old date range. No replacement dates are known. No live source fallback.",
    },
    input: refreshInput("schedule-status-river", "current"),
    initial: {
      event: {
        id: "schedule-status-river",
        slug: "river-festival",
        canonicalName: "River Festival",
        links: [
          {
            kind: "official_site",
            url: "https://schedule-fixture.example/river",
            official: true,
          },
        ],
        editions: [
          {
            id: "river-2027",
            editionKey: "2027",
            editionYear: 2027,
            startsOn: "2027-06-25",
            endsOn: "2027-06-27",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            termIds: ["validation:festival", "validation:music"],
          },
        ],
      },
    },
    sources: [
      {
        attemptedUrl: "https://schedule-fixture.example/river",
        finalUrl: "https://schedule-fixture.example/river",
        retrievedAt: "2026-11-13T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "postponed.md",
        readerOutput: {
          overview:
            "River Festival in Portugal is postponed. The June 2027 dates are withdrawn and replacement dates will be announced later.",
          coverage: {
            found: [
              "River Festival in Portugal",
              "Withdrawn 2027 festival dates",
            ],
            notPublished: ["Replacement dates for the postponed 2027 festival"],
          },
          topics: ["identity", "dates", "status", "location"],
          statedYears: ["2027"],
          limitations: [],
          evidence: [
            {
              quote: {
                start: 1,
                end: 3,
              },
              topics: ["identity", "dates", "status", "location"],
            },
          ],
        },
      },
    ],
  },
  evaluate: (context) => [
    ...researchDidNotFail(context.report),
    ...editionSlots(context, null, null),
    ...preserveDates(context.changes, "2027"),
    check(
      "toolUse.maxSearches",
      searchCount(context.calls) === 0,
      "Use zero searches when the organizer says new dates will follow",
    ),
    check(
      "catalog.editions.noReplacement",
      context.report.operations.length === 0,
      "Do not select or change an Edition with no replacement dates",
    ),
  ],
};
