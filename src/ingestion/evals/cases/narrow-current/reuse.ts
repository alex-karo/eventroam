import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionByYear,
  returned,
  omittedEventFields,
  oneNewEdition,
} from "../../research";
import { included2027Terms, preserveEventFields } from "./checks";
import { narrowFixture, summer2026 } from "./fixture";

export const narrowCurrentReuseCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("reuse", [summer2026]),
  evaluate(context) {
    const { data, changes } = context;
    const edition = editionByYear(data, 2027);
    const expectedTerms = [
      "validation:festival",
      "validation:openair",
      "validation:music",
      "catalog:term:genre:electronic",
    ];
    return [
      ...included2027Terms(changes, expectedTerms),
      ...preserveEventFields(changes),
      researchStatus(context, "success"),
      oneNewEdition(context, 2027),
      ...expectedTerms.map((term) =>
        returned("research.2027.classification", edition?.classification, term),
      ),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-06-04",
        endsOn: "2027-06-05",
        state: "confirmed",
      }),
      ...omittedEventFields(data),
    ];
  },
};
