import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  omittedEventFields,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "scope-current-stable-key": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "imported-weekend");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "imported-weekend"),
      returned("research.imported-weekend.year", edition?.year, 2026),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
