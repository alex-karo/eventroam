import { check } from "../../checks";
import type { RegressionContext, RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";

function changedDescriptions({ item, report }: RegressionContext) {
  const changes = report.changes.filter(
    ({ subject }) => subject === item.initial.event.id,
  );
  return ["description", "short_description"].map((field) => {
    const value = changes.find((change) => change.field === field)?.newValue;
    return typeof value === "string" ? value.trim() : "";
  });
}

function descriptionChecks(
  { report }: RegressionContext,
  texts: string[],
  expected: RegExp,
  excluded: RegExp,
) {
  const withoutEditionDetails =
    /7[, .]?500|202[56]|volunteers?|tickets?|prices?|has (included|featured|offered)|previously/i;
  return [
    check(
      "research.descriptions.content",
      texts.every(
        (text) =>
          text &&
          !/River Festival/i.test(text) &&
          !excluded.test(text) &&
          !withoutEditionDetails.test(text),
      ) && expected.test(texts.join(" ")),
      "Save two current descriptions without historical attendance or Edition details",
    ),
    check(
      "catalog.descriptions.editor",
      report.editorStatus === "success" && texts.every(Boolean),
      "Editor approves both descriptions for the catalog",
    ),
  ];
}

export const checks = {
  "size-historical-and-unknown": (context) => {
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
  "description-announced-move": (context) => {
    const texts = changedDescriptions(context);
    const urban = /urban|city|square/i;
    return [
      ...descriptionChecks(context, texts, urban, /forest|camping|jazz/i),
      check(
        "research.descriptions.announcedMove",
        texts.every((text) => urban.test(text)),
        "Both descriptions use the announced urban setting",
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
