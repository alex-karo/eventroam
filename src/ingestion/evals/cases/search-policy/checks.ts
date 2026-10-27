import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  type ResearchEvaluator,
} from "../../research";

export const researchChecks = {
  "search-no-announcement": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "2026", null),
    ];
  },
  "search-no-optional-field": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "search-unknown-official": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "search-inaccessible-official": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "search-wrong-official": (context) => {
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "search-date-conflict": (context) => {
    const { data } = context;
    const edition = editionByKey(data, "2027");
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.dates", edition?.dates, {
        startsOn: "2027-01-23",
        endsOn: "2027-01-30",
      }),
    ];
  },
} satisfies Record<string, ResearchEvaluator>;
