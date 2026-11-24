import type { RegressionCaseDefinition } from "../../regression";
import {
  included2027Terms,
  new2027ResearchChecks,
  preserveEventFields,
} from "./checks";
import { narrowFixture, summer2026 } from "./fixture";

export const narrowCurrentReuseCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture("reuse", [summer2026]),
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
      ...new2027ResearchChecks(context, expectedTerms),
    ];
  },
};
