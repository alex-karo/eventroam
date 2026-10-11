import type { ResearchCatalog } from "./context";

export type RefreshScope = "full" | "current";
export const fieldRegistry = {
  event: [
    "summary",
    "website",
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "x",
    "other",
  ],
  edition: [
    "year",
    "dates",
    "scheduleStatus",
    "displayName",
    "venueName",
    "venueAddress",
    "locality",
    "administrativeArea",
    "countryCode",
    "coordinates",
    "capacityEstimate",
    "classification",
    "tickets",
    "ticketLink",
  ],
} as const;
export type RefreshContext = {
  scope: RefreshScope;
  referenceInstant: string;
  savedEditions: ResearchCatalog[number]["editions"];
  fieldRegistry: typeof fieldRegistry;
  rules: string[];
  countryBaseline: { id: string; key: string; countryCode: string | null }[];
};
export function createRefreshContext(
  scope: RefreshScope,
  savedEditions: RefreshContext["savedEditions"],
  referenceInstant: string,
): RefreshContext {
  return {
    scope,
    referenceInstant,
    savedEditions,
    fieldRegistry,
    rules: [
      scope === "full"
        ? "Check every saved Edition, including history and farther future, plus at most one missing ongoing or nearest future Edition."
        : "Check Event facts and at most one ongoing or nearest future Edition; preserve other Editions.",
      "Check announcements and filled/missing supported fields for errors and updates; saved facts are leads, not source proof.",
      "Choose an ongoing Edition first, otherwise the nearest future; include the local final day using saved timeZone or UTC fallback at referenceInstant.",
      "Preserve saved keys for matched Editions, including corrected years/dates and multiple weekends. Year alone is not identity.",
      "Exclude a current candidate only on source-confirmed cancellation/postponement without replacement dates. Supported replacements keep the same key. Full still checks saved exclusions.",
      "Resolve ties, overlaps and uncertain matching/order within the budget. If ambiguity remains, propose no arbitrary current target and report an unfinished question in unresolved; useful Event/full facts can be partial.",
      "Completed announcement checks with no eligible target can succeed without an Edition proposal. No intermediate selection call or output is required.",
    ],
    countryBaseline: savedEditions.map((e) => ({
      id: e.id,
      key: e.editionKey,
      countryCode: e.countryCode?.toUpperCase() ?? null,
    })),
  };
}
export function countryBaselineConflict(context: RefreshContext) {
  return (
    new Set(context.countryBaseline.map((e) => e.countryCode).filter(Boolean))
      .size > 1
  );
}
