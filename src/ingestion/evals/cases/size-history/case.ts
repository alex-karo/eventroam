import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";
import { searchCount } from "../../tool-use";
import { changedDescriptions, descriptionChecks } from "./checks";
import { programmeEvidence, sizeHistoryFixture } from "./fixture";

export const sizeHistoricalAndUnknownCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: sizeHistoryFixture(
    {
      id: "size-historical-and-unknown",
      task: "Check size history case",
      note: "Checks a supported historical participant estimate and preservation when no estimate is published. The synthetic page explicitly establishes that the historical Edition took place, so realization ambiguity cannot hide the size check. No live HTTP or search fallback. Fixed Reader evidence supplies the standing programme with the classification topic only.",
    },
    "page.md",
    {
      coverage: {
        found: [
          "River Grounds festival venue in River Town, Portugal",
          "10–12 October 2026 programme took place",
          "1–3 November 2026 programme announced",
          "Festival format and activities",
          "2025 participant count supports the October 2026 estimate",
        ],
        notPublished: [
          "This is the complete available festival information",
          "No ticket categories, prices or ticket shop published here",
        ],
      },
      evidence: [
        ...programmeEvidence,
        {
          quote: 6,
          topics: ["dates", "tickets", "links"],
        },
      ],
    },
  ),
  evaluate(context) {
    const { data, changes, report } = context;
    const edition = editionByKey(data, "historical");
    return [
      ...descriptionChecks(
        context,
        changedDescriptions(context),
        /workshops?|camping|danc/i,
        /free camping|nonstop|non-stop/i,
      ),
      check(
        "research.historical.sizeEstimate.reason",
        report.changes.some(
          (change) =>
            change.field === "size_estimate" &&
            change.newValue === 7500 &&
            /2025/.test(change.explanations.join(" ")) &&
            /volunteers/i.test(change.explanations.join(" ")),
        ),
        "Keep the historical year and inclusion of volunteers in the attendance reason",
      ),
      check(
        "catalog.edition.historical.size_estimate.set.1",
        changes.edition(
          { key: "historical" },
          "size_estimate",
          (value) => value === 7500,
        ),
        "Set historical participant estimate to 7500",
      ),
      check(
        "catalog.edition.historical.size_estimate.preserve.1",
        !changes.edition(
          { key: "historical" },
          "size_estimate",
          (value) => value !== 7500 && value != null,
        ),
        "Keep historical participant estimate equal to 7500 when supplied",
      ),
      check(
        "catalog.edition.unknown.size_estimate.preserve.2",
        !changes.edition(
          { key: "unknown" },
          "size_estimate",
          (value) => value !== 6000 && value != null,
        ),
        "Keep unknown participant estimate equal to 6000 when supplied",
      ),
      check(
        "catalog.edition.unknown.size_estimate.preserve.3",
        !changes.edition(
          { key: "unknown" },
          "size_estimate",
          (value) => value === null,
        ),
        "Do not set unknown participant estimate to null",
      ),
      researchStatus(context, "success"),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) === 0,
        "Use zero searches when the page covers both Editions",
      ),
      ...editionSlots(context, "historical", "unknown"),
      returned(
        "research.historical.dates",
        selectedEditionDates(context, "historical"),
        {
          startsOn: "2026-10-10",
          endsOn: "2026-10-12",
          state: "confirmed",
        },
      ),
      returned("research.historical.sizeEstimate", edition?.sizeEstimate, 7500),
      returned(
        "research.unknown.dates",
        selectedEditionDates(context, "unknown"),
        {
          startsOn: "2026-11-01",
          endsOn: "2026-11-03",
          state: "confirmed",
        },
      ),
    ];
  },
};
