export const publicationStates = ["draft", "published", "withdrawn"] as const;
export const facets = [
  "event_type",
  "format",
  "topic",
  "genre",
  "culture",
] as const;
export const scopes = ["festivals"] as const;
export const dateStates = ["unknown", "provisional", "confirmed"] as const;
export const scheduleStatuses = [
  "announced",
  "scheduled",
  "postponed",
  "cancelled",
] as const;
export const ticketAvailabilities = [
  "unknown",
  "available",
  "sold_out",
  "closed",
] as const;
export const coordinatePrecisions = [
  "unknown",
  "exact",
  "approximate",
  "locality",
  "region",
] as const;
export const paidPriceKinds = ["exact", "from", "range"] as const;
export const priceKinds = ["free", ...paidPriceKinds] as const;
export const priceCoverages = ["full_programme", "day", "package"] as const;
export const sourceKinds = [
  "website",
  "social",
  "feed",
  "api",
  "submission",
  "manual_reference",
] as const;
export const sourceAuthorities = [
  "official",
  "partner",
  "secondary",
  "community",
] as const;
export const linkKinds = [
  "official_site",
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "ticketing",
  "other",
] as const;
