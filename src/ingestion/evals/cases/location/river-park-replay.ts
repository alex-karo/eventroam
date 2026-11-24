import type { LocationTarget } from "../../../roles/location/input";
import { locationEvidence, savedTarget } from "./fixture";
import { candidate } from "../geocoding";

export const lisbonCandidates = [
  candidate({
    latitude: 38.72,
    longitude: -9.15,
    label: "Lisbon",
    countryCode: "PT",
    objectType: "locality",
    originalType: "city",
  }),
];

type SavedPoint = Pick<
  NonNullable<LocationTarget["saved"]>,
  "latitude" | "longitude" | "coordinatePrecision"
>;

export function riverParkTarget(caseName: string, currentPoint: SavedPoint) {
  const savedLocation = {
    venueName: "River Park",
    venueAddress: null,
    locality: "Lisbon",
    administrativeArea: null,
    countryCode: "PT",
    eventId: `event-${caseName}`,
    version: 1,
    scheduleStatus: "scheduled",
  } as const;
  return savedTarget(
    {
      ...savedLocation,
      id: `${caseName}-2027`,
      editionKey: "2027",
      editionYear: 2027,
      startsOn: "2027-07-01",
      endsOn: "2027-07-03",
      ...currentPoint,
    },
    {
      ...savedLocation,
      id: `${caseName}-2026`,
      editionKey: "2026",
      editionYear: 2026,
      startsOn: "2026-07-01",
      endsOn: "2026-07-03",
      latitude: 38.73,
      longitude: -9.16,
      coordinatePrecision: "approximate",
    },
  );
}

export function riverParkEvidence(announcement: string) {
  return [
    locationEvidence("2027", 1, 'venueName: "River Park"', [announcement]),
    locationEvidence("2027", 2, 'locality: "Lisbon"', [announcement]),
    locationEvidence("2027", 3, 'countryCode: "PT"', [announcement]),
  ];
}

export function nearbyKiosk(latitude: number, longitude: number) {
  return candidate({
    latitude,
    longitude,
    label: "Nearby kiosk",
    name: "Nearby kiosk",
    countryCode: "PT",
    objectType: "venue",
    originalType: "building",
  });
}
