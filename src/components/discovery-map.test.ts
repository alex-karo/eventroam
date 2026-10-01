import { expect, test } from "vitest";
import { mapFeatures, hasMapPoint } from "./discovery-map";
import type { DiscoverySummary } from "../application/discovery";

const base: DiscoverySummary = {
  id: "located",
  eventSlug: "fictional",
  eventName: "Fictional Festival",
  aliases: [],
  name: null,
  year: 2027,
  key: "2027",
  startsOn: "2027-06-01",
  endsOn: "2027-06-03",
  dateState: "confirmed",
  status: "scheduled",
  ticketAvailability: "sold_out",
  countryCode: "PT",
  locality: "Example Valley",
  administrativeArea: null,
  venueName: null,
  latitude: 38,
  longitude: -9,
  coordinatePrecision: "locality",
  timeZone: "Europe/Lisbon",
  capacityEstimate: null,
  genres: [],
};

test("map features retain approximate labels and exclude unlocated summaries", () => {
  const unlocated = {
    ...base,
    id: "unlocated",
    latitude: null,
    longitude: null,
  };
  expect(hasMapPoint(unlocated)).toBe(false);
  expect(mapFeatures([base, unlocated])).toEqual({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "located",
        geometry: { type: "Point", coordinates: [-9, 38] },
        properties: {
          id: "located",
          name: "Fictional Festival 2027",
          approximate: true,
          soldOut: true,
        },
      },
    ],
  });
});
