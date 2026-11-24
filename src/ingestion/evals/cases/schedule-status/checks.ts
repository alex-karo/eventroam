import { check, contains } from "../../checks";
import { preserveDates } from "../../changes";
import type { RegressionContext, RegressionEvaluator } from "../../regression";
import { editionSlots, researchDidNotFail } from "../../research";
import { searchCount } from "../../tool-use";

function scheduled(context: RegressionContext, keys: string[]) {
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
      )!;
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

const jazz: RegressionEvaluator = (context) => [
  ...editionSlots(context, "2026", "2027"),
  ...scheduled(context, ["2026", "2027"]),
];

export const checks = {
  "schedule-status-jazz": (context) => [
    ...jazz(context),
    check(
      "toolUse.maxSearches",
      searchCount(context.calls) === 0,
      "Use zero searches when known pages cover both programmes",
    ),
  ],
  "schedule-status-jazz-editor": (context) => [
    ...jazz(context),
    ...["previousEdition", "currentOrNextEdition"].map((slot) =>
      check(
        `editor.${slot}.scheduleStatus`,
        contains(context.report.editorResponse?.object, {
          decisions: {
            path: `${slot}.fields.scheduleStatus`,
            decision: "approve",
          },
        }),
        "Approve scheduled with the supported current dates",
      ),
    ),
  ],
  "schedule-status-marco": (context) => [
    check(
      "sources.replacementAnnouncement",
      context.report.sources.some(
        (source) =>
          source.attemptedUrl === context.item.sources[1].attemptedUrl &&
          source.outcome === "ok",
      ),
      "Inspect the supplied replacement announcement URL",
    ),
    ...editionSlots(context, null, "2026"),
    ...scheduled(context, ["2026"]),
  ],
  "schedule-status-postponed": (context) => [
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
} satisfies Record<string, RegressionEvaluator>;
