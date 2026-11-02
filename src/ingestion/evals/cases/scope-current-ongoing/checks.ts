import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
  omittedEventFields,
} from "../../research";

export const checks = {
  "scope-current-ongoing": (context) => {
    const { data } = context;
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "autumn-weekend"),
      returned(
        "research.autumn-weekend.dates",
        selectedEditionDates(context, "autumn-weekend"),
        {
          startsOn: "2026-10-01",
          endsOn: "2026-10-03",
          state: "confirmed",
        },
      ),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
