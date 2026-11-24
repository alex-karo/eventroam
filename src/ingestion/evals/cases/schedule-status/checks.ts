import { check } from "../../checks";
import { preserveDates } from "../../changes";
import type { RegressionContext } from "../../regression";
import { researchDidNotFail } from "../../research";
export function checkScheduledEditions(
  context: RegressionContext,
  keys: string[],
) {
  const { item, report, changes } = context;
  return [
    ...researchDidNotFail(report),
    check(
      "editor.status",
      report.editorStatus === "success",
      "Complete the Editor review",
    ),
    check(
      "catalog.editions.keepKeys",
      !report.operations.some(
        (operation) => operation.kind === "createEdition",
      ),
      "Keep the saved Edition identities",
    ),
    ...keys.flatMap((key) => {
      const saved = item.initial.event.editions.find(
        (edition) => edition.editionKey === key,
      );
      if (!saved) {
        return [
          check(
            `catalog.${key}.savedEdition`,
            false,
            `Case "${item.id}" is missing Edition "${key}" in its initial catalog.`,
          ),
        ];
      }
      return [
        ...preserveDates(changes, key),
        check(
          `catalog.${key}.scheduleStatus`,
          (saved.scheduleStatus === "scheduled" ||
            changes.edition(
              { key },
              "schedule_status",
              (value) => value === "scheduled",
            )) &&
            !changes.edition(
              { key },
              "schedule_status",
              (value) => value !== "scheduled",
            ),
          "Keep current programme dates scheduled after Editor review",
        ),
        check(
          `catalog.${key}.dateState`,
          !changes.edition(
            { key },
            "date_state",
            (value) => value !== "confirmed",
          ),
          "Keep the confirmed date range",
        ),
      ];
    }),
  ];
}
