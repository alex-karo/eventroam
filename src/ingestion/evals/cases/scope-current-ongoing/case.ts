import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
  omittedEventFields,
} from "../../research";
import { scopeEdition, scopeFixture } from "../scope-fixture";

export const scopeCurrentOngoingCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: scopeFixture(
    "scope-current-ongoing",
    "Check scope current ongoing case",
    "current",
    [
      scopeEdition("autumn-weekend", 2026, "2026-10-01", "2026-10-03"),
      scopeEdition("later-weekend", 2026, "2026-10-10", "2026-10-11"),
    ],
  ),
  evaluate(context) {
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
};
