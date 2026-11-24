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
import { narrowFixture, summer2026 } from "./fixture";

export const narrowCurrentChangedCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: narrowFixture(
    "changed",
    [summer2026],
    "Synthetic official announcements isolate scope and continuity decisions. The main programme is split evenly between indoor and open-air stages; no live source fallback.",
  ),
  evaluate(context) {
    const { data, changes } = context;
    const edition = editionByYear(data, 2027);
    const expectedTerms = [
      "validation:festival",
      "validation:mixed",
      "validation:music",
      "catalog:term:genre:metal",
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
            value?.some((item) => item === "validation:openair") === true,
        ),
        "Exclude unsupported classification for 2027",
      ),
      check(
        "catalog.edition.2027.terms.preserve.4",
        !changes.edition(
          { year: 2027 },
          "terms",
          (value) =>
            value?.some((item) => item === "catalog:term:genre:electronic") ===
            true,
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
