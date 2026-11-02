import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
} from "../../research";
import { check } from "../../checks";

export const checks = {
  "scope-full-unfinished-history": (context) => {
    const { report } = context;
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "announced-weekend"),
      returned(
        "research.announced-weekend.dates",
        selectedEditionDates(context, "announced-weekend"),
        {
          startsOn: "2026-10-10",
          endsOn: "2026-10-11",
          state: "confirmed",
        },
      ),
      check(
        "research.unresolved.historic-weekend",
        report.unresolved.some((question) =>
          /histor|archive|2025|previous|past edition/i.test(question.message),
        ),
        "Explain the unresolved historical check without requiring an Edition key",
      ),
      check(
        "catalog.history.preserved",
        !report.changes.some(
          (change) => change.subject === "scope-edition-historic-weekend",
        ),
        "Preserve the unverified saved historical Edition",
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
