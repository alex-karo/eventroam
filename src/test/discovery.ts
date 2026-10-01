import type { DiscoverySummary } from "../application/discovery";

export function testSummary(
  values: Partial<DiscoverySummary> = {},
): DiscoverySummary {
  return {
    id: "test-occurrence",
    eventSlug: "test-event",
    eventName: "Test Event",
    aliases: [],
    name: null,
    year: 2027,
    key: "2027",
    startsOn: "2027-07-01",
    endsOn: "2027-07-01",
    dateState: "confirmed",
    status: "scheduled",
    ticketAvailability: "unknown",
    countryCode: "PT",
    locality: "Test Valley",
    administrativeArea: null,
    venueName: null,
    latitude: null,
    longitude: null,
    coordinatePrecision: "unknown",
    timeZone: null,
    capacityEstimate: null,
    genres: [],
    ...values,
  };
}
