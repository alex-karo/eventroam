import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "size-evidence": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "participants");
    const previous = editionByKey(data, "repeat-admissions");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "repeat-admissions", "participants"),
      returned("research.participants.dates", edition?.dates, {
        startsOn: "2026-10-01",
        endsOn: "2026-10-03",
        state: "confirmed",
      }),
      returned(
        "research.participants.sizeEstimate",
        edition?.sizeEstimate,
        8000,
      ),
      returned("research.repeat-admissions.dates", previous?.dates, {
        startsOn: "2026-09-20",
        endsOn: "2026-09-22",
        state: "confirmed",
      }),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
