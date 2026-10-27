import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";
import { check } from "../../checks";

export const researchChecks = {
  "scope-full-unfinished-history": (context) => {
    const { report, data } = context;
    const edition = editionByKey(data, "announced-weekend");
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "announced-weekend"),
      returned("research.announced-weekend.dates", edition?.dates, {
        startsOn: "2026-10-10",
        endsOn: "2026-10-11",
        state: "confirmed",
      }),
      check(
        "research.unresolved.historic-weekend",
        report.unresolved.some(
          (question) =>
            question.editionKey === "historic-weekend" &&
            question.message.trim().length > 0,
        ),
        "Unfinished historic-weekend",
      ),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
