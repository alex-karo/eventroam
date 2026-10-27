import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  omittedEventFields,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "scope-current-replacement": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "replacement-weekend");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "replacement-weekend"),
      returned("research.replacement-weekend.dates", edition?.dates, {
        startsOn: "2026-10-06",
        endsOn: "2026-10-07",
        state: "confirmed",
      }),
      returned(
        "research.replacement-weekend.scheduleStatus",
        edition?.scheduleStatus,
        "scheduled",
      ),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
