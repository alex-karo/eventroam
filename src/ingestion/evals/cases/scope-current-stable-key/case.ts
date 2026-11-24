import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  selectedEditionYear,
  returned,
  omittedEventFields,
} from "../../research";
import { scopeEdition, scopeFixture } from "../scope-fixture";

export const scopeCurrentStableKeyCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: scopeFixture(
    "scope-current-stable-key",
    "Check scope current stable key case",
    "current",
    [
      scopeEdition("imported-weekend", 2025, "2026-10-04", "2026-10-05"),
      scopeEdition("second-weekend", 2026, "2026-10-11", "2026-10-12"),
    ],
  ),
  evaluate(context) {
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
};
