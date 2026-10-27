import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "size-historical-and-unknown": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "historical");
    const previous = editionByKey(data, "unknown");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "historical", "unknown"),
      returned("research.historical.dates", edition?.dates, {
        startsOn: "2026-10-10",
        endsOn: "2026-10-12",
        state: "confirmed",
      }),
      returned("research.historical.sizeEstimate", edition?.sizeEstimate, 7500),
      returned("research.unknown.dates", previous?.dates, {
        startsOn: "2026-11-01",
        endsOn: "2026-11-03",
        state: "confirmed",
      }),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
