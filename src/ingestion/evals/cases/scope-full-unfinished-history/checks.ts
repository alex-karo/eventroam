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
        report.unresolved.some(
          (question) =>
            question.editionKey === "historic-weekend" &&
            question.message.trim().length > 0,
        ),
        "Unfinished historic-weekend",
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
