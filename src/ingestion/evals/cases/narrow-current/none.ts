import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  omittedEventFields,
} from "../../research";
import { check } from "../../checks";
import { preserveEventFields } from "./checks";
import { narrowFixture, summer2026 } from "./fixture";

export const narrowCurrentNoneCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("none", [summer2026]),
  evaluate(context) {
    const { report, data, changes } = context;
    return [
      ...preserveEventFields(changes),
      check(
        "catalog.edition.2026.starts_on.preserve.3",
        !changes.edition(
          { key: "2026" },
          "starts_on",
          (value) => value != null,
        ),
        "Preserve 2026 programme start",
      ),
      check(
        "catalog.edition.2026.ends_on.preserve.4",
        !changes.edition({ key: "2026" }, "ends_on", (value) => value != null),
        "Preserve 2026 programme end",
      ),
      check(
        "catalog.edition.2026.terms.preserve.5",
        !changes.edition({ key: "2026" }, "terms", (value) => value != null),
        "Preserve 2026 classification",
      ),
      check(
        "catalog.edition.2026.venue_name.preserve.6",
        !changes.edition(
          { key: "2026" },
          "venue_name",
          (value) => value != null,
        ),
        "Preserve 2026 venue name",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, null, null),
      ...omittedEventFields(data),
      check(
        "research.changes",
        report.changes.length === 0,
        "Expected no catalog changes",
      ),
    ];
  },
};
