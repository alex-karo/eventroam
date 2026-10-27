import {
  researchStatus,
  researchDidNotFail,
  editionSlots,
  editionByKey,
  returned,
  refusedResearch,
  unavailableSources,
  type ResearchEvaluator,
} from "../../research";
import { check } from "../../checks";

export const researchChecks = {
  "editor-wrong-year": ({ report }) => researchDidNotFail(report),
  "editor-day-ticket": ({ report }) => researchDidNotFail(report),
  "editor-clear": ({ report }) => researchDidNotFail(report),
  "editor-valid-update": ({ report }) => researchDidNotFail(report),
  "editor-unavailable": (context) => {
    const { report } = context;
    return [...refusedResearch(report), ...unavailableSources(report)];
  },
  "editor-recovered-website": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "editor-unknown-currency": (context) => {
    const { report, data } = context;
    const edition = editionByKey(data, "2027");
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.tickets", edition?.tickets, { basePrice: null }),
      check(
        "research.unresolved",
        report.unresolved.some(
          (question) => question.message.trim().length > 0,
        ),
        "Has unresolved questions=true",
      ),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
