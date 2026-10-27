import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";
import { check } from "../../checks";

export const researchChecks = {
  "source-known-offers-blocked-checkout": (context) => {
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
  "source-stale-language-other-programme": (context) => {
    const { report, data } = context;
    const edition = editionByKey(data, "2027");
    return [
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-01-23",
        endsOn: "2027-01-30",
        state: "confirmed",
      }),
      check(
        "research.unresolved",
        report.unresolved.some(
          (question) => question.message.trim().length > 0,
        ),
        "Has unresolved questions=true",
      ),
    ];
  },
  "source-homonym-wrong-saved-website": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "2027");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.countryCode", edition?.countryCode, "GB"),
      returned("research.2027.tickets", edition?.tickets, {
        basePrice: { kind: "free" },
      }),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
