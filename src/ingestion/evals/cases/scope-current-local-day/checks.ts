import {
  researchStatus,
  editionSlots,
  omittedEventFields,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "scope-current-local-day": (context) => {
    const { data } = context;
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "local-weekend"),
      ...omittedEventFields(data),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
