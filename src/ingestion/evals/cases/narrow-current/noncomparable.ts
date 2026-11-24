import type { RegressionCaseDefinition } from "../../regression";
import { check } from "../../checks";
import {
  included2027Terms,
  new2027ResearchChecks,
  preserveEventFields,
} from "./checks";
import { narrowFixture, summer2026, autumn2026 } from "./fixture";

export const narrowCurrentNoncomparableCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("noncomparable", [
    { ...summer2026, id: "narrow-spring-2026", editionKey: "spring-2026" },
    autumn2026,
  ]),
  evaluate(context) {
    const { changes } = context;
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
      ...new2027ResearchChecks(context, expectedTerms),
    ];
  },
};
