import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  selectedEditionYear,
  returned,
  omittedEventFields,
} from "../../research";

export const checks = {
  "scope-current-stable-key": (context) => {
    const { data } = context;
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "imported-weekend"),
      returned(
        "research.imported-weekend.year",
        selectedEditionYear(context, "imported-weekend"),
        2026,
      ),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
