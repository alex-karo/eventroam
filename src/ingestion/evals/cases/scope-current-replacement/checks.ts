import type { RegressionEvaluator } from "../../regression";
import { check } from "../../checks";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
  omittedEventFields,
} from "../../research";
import { searchCount } from "../../tool-use";

export const checks = {
  "scope-current-replacement": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "replacement-weekend");
    return [
      researchStatus(context, "success"),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) === 0,
        "Use zero searches when the page resolves the dates and names the place",
      ),
      ...editionSlots(context, null, "replacement-weekend"),
      returned(
        "research.replacement-weekend.dates",
        selectedEditionDates(context, "replacement-weekend"),
        {
          startsOn: "2026-10-06",
          endsOn: "2026-10-07",
          state: "confirmed",
        },
      ),
      returned(
        "research.replacement-weekend.scheduleStatus",
        edition?.scheduleStatus,
        "scheduled",
      ),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
