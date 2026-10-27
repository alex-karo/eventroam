import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  omittedEventFields,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "scope-current-ongoing": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "autumn-weekend");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "autumn-weekend"),
      returned("research.autumn-weekend.dates", edition?.dates, {
        startsOn: "2026-10-01",
        endsOn: "2026-10-03",
        state: "confirmed",
      }),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
