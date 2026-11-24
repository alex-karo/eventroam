import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  omittedEventFields,
} from "../../research";
import { check } from "../../checks";
import { preserveEventFields } from "./checks";
import { narrowFixture, summer2027 } from "./fixture";

export const narrowCurrentStableCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("stable", [summer2027]),
  evaluate(context) {
    const { data, changes } = context;
    const edition = editionByKey(data, "2027");
    return [
      check(
        "catalog.edition.2027.venue_name.set.1",
        changes.edition(
          { key: "2027" },
          "venue_name",
          (value) => value === "New Grounds",
        ),
        'Set 2027 venue name to "New Grounds"',
      ),
      ...preserveEventFields(changes),
      check(
        "catalog.edition.2027.terms.preserve.3",
        !changes.edition({ key: "2027" }, "terms", (value) => value != null),
        "Preserve 2027 classification",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      ...omittedEventFields(data),
      check(
        "research.2027.sizeEstimate",
        !!edition && edition.sizeEstimate == null,
        "Omitted 2027.sizeEstimate",
      ),
      check(
        "research.2027.venueAddress",
        !!edition && edition.venueAddress == null,
        "Omitted 2027.venueAddress",
      ),
      check(
        "research.2027.coordinates",
        !!edition && edition.coordinates == null,
        "Omitted 2027.coordinates",
      ),
    ];
  },
};
