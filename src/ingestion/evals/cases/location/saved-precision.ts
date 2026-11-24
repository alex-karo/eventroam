import type { LocationCaseDefinition } from "../../location";
import type { LocationTarget } from "../../../roles/location/input";
import { pointChanged, pointQuestion, replacePoint } from "./assertions";
import { locationInput, savedTarget, locationEvidence } from "./fixture";
import { geocodingUnavailable } from "../geocoding";
import { refreshInput } from "../fixture";

const editionKey = "2027";
const eventId = "event:7c4bee6a0db9e3b8f696";
const savedEdition: NonNullable<LocationTarget["saved"]> = {
  venueName: "Azucreira de Portas",
  venueAddress: null,
  locality: "Portas",
  administrativeArea: "Pontevedra",
  countryCode: "ES",
  id: "f9a70691-9caf-4e81-9de8-fcdad0218541",
  eventId,
  editionKey,
  version: 5,
  editionYear: 2027,
  startsOn: "2027-07-08",
  endsOn: "2027-07-10",
  scheduleStatus: "scheduled",
  latitude: 42.579634,
  longitude: -8.669209,
  coordinatePrecision: "exact",
};

export const locationSavedPrecisionCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-saved-precision",
    suite: "regression",
    origin: "synthetic",
    task: "Check location saved precision",
    provenance: {
      kind: "synthetic",
      note: "A synthetic source confirms that the saved point represents a locality, with overstated exact precision. Geocoding is unavailable. This case tests a precision change without a replacement point; the coordinates must stay unchanged. The precision notice is now supplied as explicit synthetic evidence, not only as a source summary. It states the existing locality meaning without giving an expected action.",
    },
    input: refreshInput(eventId),
    location: {
      group: "correction",
      input: locationInput(savedTarget(savedEdition), {
        festival: {
          name: "PortAmérica",
          summary:
            "A recurring Galician festival combining live music, gastronomy and community, with additional cultural programming.",
          format: ["openair"],
        },
        countryBaseline: "ES",
        sources: [
          {
            url: "https://fixture.test/precision",
            information:
              "The saved coordinates identify the centre of Portas, Pontevedra, Spain. Azucreira de Portas remains the festival venue, but these coordinates do not identify the venue. No venue point is available.",
          },
        ],
        evidence: [
          locationEvidence(
            editionKey,
            "precision",
            "The saved 2027 point at (42.579634, -8.669209) represents the centre of Portas, Pontevedra, Spain. It is a valid locality point, but it does not identify Azucreira de Portas. The festival venue remains Azucreira de Portas. No venue point has been established.",
            [
              "Synthetic precision notice for the 2027 Edition. This is a stated locality meaning, not a reverse-geocoding inference.",
            ],
            "synthetic-precision-notice",
          ),
          locationEvidence(editionKey, 1, 'venueName: "Azucreira de Portas"'),
          locationEvidence(editionKey, 2, 'locality: "Portas"'),
          locationEvidence(editionKey, 3, 'administrativeArea: "Pontevedra"'),
          locationEvidence(editionKey, 4, 'countryCode: "ES"'),
        ],
      }),
    },
    geocoding: [
      geocodingUnavailable({
        direction: "forward",
        query: "Azucreira de Portas, Portas, Pontevedra, ES",
        countryCode: "ES",
      }),
      geocodingUnavailable({
        direction: "forward",
        query: "Azucreira de Portas, Portas, Pontevedra, Spain",
        countryCode: "ES",
      }),
      geocodingUnavailable({
        direction: "forward",
        query: "Portas, Pontevedra, Spain",
        countryCode: "ES",
      }),
      geocodingUnavailable({
        direction: "reverse",
        latitude: 42.579634,
        longitude: -8.669209,
      }),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.579634,
        longitude: -8.669209,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
};
