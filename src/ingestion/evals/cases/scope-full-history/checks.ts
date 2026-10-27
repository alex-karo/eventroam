import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "scope-full-history": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "historic-weekend");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "historic-weekend", "announced-weekend"),
      returned(
        "research.historic-weekend.venueName",
        edition?.venueName,
        "River Grounds",
      ),
      returned("research.historic-weekend.dates", edition?.dates, {
        startsOn: "2025-06-01",
        endsOn: "2025-06-03",
        state: "confirmed",
      }),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
