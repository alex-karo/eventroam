import type { LocationTarget } from "../../../roles/location/input";
import { check } from "../../checks";
import type { LocationContext } from "../../location";
import { locationInput, locationEvidence, savedTarget } from "./fixture";

const editionKey = "2027";
export const moveEventId = "event:7c4bee6a0db9e3b8f696";
export const savedEdition = {
  venueName: "Old field",
  venueAddress: "Old road 1",
  locality: "Portas",
  administrativeArea: "Pontevedra",
  countryCode: "ES",
  id: "f9a70691-9caf-4e81-9de8-fcdad0218541",
  eventId: moveEventId,
  editionKey,
  version: 5,
  editionYear: 2027,
  startsOn: "2027-07-08",
  endsOn: "2027-07-10",
  scheduleStatus: "scheduled",
  latitude: 42.579634,
  longitude: -8.669209,
  coordinatePrecision: "exact",
} satisfies NonNullable<LocationTarget["saved"]>;

export function movedFieldInput() {
  return locationInput(savedTarget(savedEdition), {
    festival: {
      name: "Synthetic venue move",
      summary:
        "A recurring Galician festival combining live music, gastronomy and community, with additional cultural programming.",
      format: ["openair"],
    },
    countryBaseline: "ES",
    sources: [
      {
        url: "https://fixture.test/venue-move",
        information:
          "The next Edition moves from Old field to New field in Portas. Old road 1 and the saved point no longer apply. The exact new venue point is unavailable.",
      },
    ],
    evidence: [
      locationEvidence(editionKey, 1, 'venueName: "New field"', [
        "Official announcement states a move to the new field",
      ]),
      locationEvidence(editionKey, 2, 'locality: "Portas"'),
      locationEvidence(editionKey, 3, 'administrativeArea: "Pontevedra"'),
      locationEvidence(editionKey, 4, 'countryCode: "ES"'),
      locationEvidence(editionKey, 5, "venueAddress: null", [
        "Old road address no longer applies after the move",
      ]),
    ],
  });
}

export function movedVenue(edition: ReturnType<LocationContext["edition"]>) {
  return [
    check(
      "location.venueAddress",
      edition?.venueAddress.action === "clear" &&
        edition.saved?.venueAddress != null,
      "Clear the old venue address",
    ),
    check(
      "location.venueName",
      edition?.venueName.action === "set" &&
        edition.venueName.value === "New field" &&
        edition.saved?.venueName !== "New field",
      "Change the venue name to New field",
    ),
  ];
}
