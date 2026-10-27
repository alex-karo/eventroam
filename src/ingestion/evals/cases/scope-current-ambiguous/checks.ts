import {
  researchStatus,
  editionSlots,
  omittedEventFields,
  type ResearchEvaluator,
} from "../../research";
import { check } from "../../checks";

export const researchChecks = {
  "scope-current-ambiguous": (context) => {
    const { report, data } = context;
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, null),
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
} satisfies Record<string, ResearchEvaluator>;
