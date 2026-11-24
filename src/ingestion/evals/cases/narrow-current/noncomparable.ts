import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionByYear,
  returned,
  omittedEventFields,
  oneNewEdition,
} from "../../research";
import { check } from "../../checks";
import { included2027Terms, preserveEventFields } from "./checks";
import { narrowFixture, summer2026, autumn2026 } from "./fixture";

export const narrowCurrentNoncomparableCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("noncomparable", [
    { ...summer2026, id: "narrow-spring-2026", editionKey: "spring-2026" },
    autumn2026,
  ]),
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
      check(
        "catalog.edition.2027.terms.preserve.3",
        !changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:metal") === true,
        ),
        "Exclude unsupported classification for 2027",
      ),
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
