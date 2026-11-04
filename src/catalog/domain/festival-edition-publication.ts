import { defineEditionRules } from "./edition-rules";

const needsDatesAndYear = "Publication needs supported dates and year";

export const festivalEditionRules = defineEditionRules({
  requiredFields: [
    { field: "editionYear", message: needsDatesAndYear },
    { field: "startsOn", message: needsDatesAndYear },
    { field: "endsOn", message: needsDatesAndYear },
    { field: "countryCode", message: "Publication needs country" },
  ],

  requiredFacetGroups: [
    { anyOf: ["event_type"], message: "Festival scope requires event type" },
    {
      anyOf: ["topic", "culture"],
      message: "Festival scope requires topic or culture",
    },
  ],
});
