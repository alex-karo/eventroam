import type { RegressionCaseDefinition } from "../../regression";
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
import { scopeEdition, scopeFixture } from "../scope-fixture";

export const scopeCurrentReplacementCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: scopeFixture(
    "scope-current-replacement",
    "Check scope current replacement case",
    "current",
    [
      scopeEdition("cancelled-weekend", 2026, "2026-10-04", "2026-10-05"),
      scopeEdition(
        "replacement-weekend",
        2026,
        "2026-10-20",
        "2026-10-21",
        "cancelled",
      ),
      scopeEdition("later-weekend", 2026, "2026-10-25", "2026-10-26"),
    ],
  ),
  evaluate(context) {
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
};
