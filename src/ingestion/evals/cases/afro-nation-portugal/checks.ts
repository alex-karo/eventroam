import { check } from "../../checks";
import type { RegressionEvaluator } from "../../regression";
import { refusedResearch, unavailableSources } from "../../research";

export const checks = {
  "afro-nation-portugal-blocked": ({ item, report }) => [
    check(
      "event.identity",
      report.eventId === item.initial.event.id,
      "Expected the saved Afro Nation Portugal Event",
    ),
    ...refusedResearch(report),
    ...unavailableSources(report),
    check(
      "task.unresolved",
      report.unresolved.some((item) => item.message.trim().length > 0),
      "Expected an unresolved question",
    ),
  ],
} satisfies Record<string, RegressionEvaluator>;
