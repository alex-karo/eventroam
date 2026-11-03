import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  omittedEventFields,
} from "../../research";

export const checks = {
  "scope-current-local-day": (context) => {
    const { data } = context;
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "local-weekend"),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
