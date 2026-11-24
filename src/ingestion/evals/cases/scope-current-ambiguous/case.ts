import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  omittedEventFields,
} from "../../research";
import { check } from "../../checks";
import { scopeEdition, scopeFixture } from "../scope-fixture";

export const scopeCurrentAmbiguousCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: scopeFixture(
    "scope-current-ambiguous",
    "Check scope current ambiguous case",
    "current",
    [
      scopeEdition("overlap-one", 2026, "2026-10-02", "2026-10-04"),
      scopeEdition("overlap-two", 2026, "2026-10-03", "2026-10-05"),
    ],
  ),
  evaluate(context) {
    const { report, data } = context;
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, null),
      check(
        "catalog.outcome",
        report.outcome === "unchanged" && report.editorStatus === "not_run",
        "Keep the catalog unchanged and stop before Editor",
      ),
      ...omittedEventFields(data),
      check(
        "research.unresolved",
        report.unresolved.some(
          (question) => question.message.trim().length > 0,
        ),
        "Has unresolved questions=true",
      ),
      check(
        "research.changes",
        report.changes.length === 0,
        "Expected no catalog changes",
      ),
    ];
  },
};
