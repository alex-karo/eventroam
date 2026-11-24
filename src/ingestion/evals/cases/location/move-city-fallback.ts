import type { LocationCaseDefinition } from "../../location";
import { pointChanged, pointQuestion, replacePoint } from "./assertions";
import { forward, geocodingUnavailable } from "../geocoding";
import { refreshInput } from "../fixture";
import { portasCandidates } from "./portas-replay";
import {
  movedFieldInput,
  movedVenue,
  moveEventId,
  savedEdition,
} from "./moved-field";

export const locationMoveCityFallbackCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-move-city-fallback",
    suite: "regression",
    origin: "synthetic",
    task: "Check location move city fallback",
    provenance: {
      kind: "synthetic",
      note: "A synthetic move uses captured provider results for a city fallback. It tests contract and policy coverage, not a real festival move.",
    },
    input: refreshInput(moveEventId),
    initial: {
      event: {
        id: moveEventId,
        slug: "location-cemetery",
        canonicalName: "PortAmérica",
        editions: [
          {
            id: savedEdition.id,
            editionKey: savedEdition.editionKey,
            editionYear: savedEdition.editionYear,
            startsOn: savedEdition.startsOn,
            endsOn: savedEdition.endsOn,
            scheduleStatus: savedEdition.scheduleStatus,
            latitude: savedEdition.latitude,
            longitude: savedEdition.longitude,
            coordinatePrecision: savedEdition.coordinatePrecision,
            venueName: savedEdition.venueName,
            venueAddress: savedEdition.venueAddress,
            locality: savedEdition.locality,
            administrativeArea: savedEdition.administrativeArea,
            countryCode: savedEdition.countryCode,
          },
        ],
      },
    },
    location: {
      group: "correction",
      input: movedFieldInput(),
    },
    geocoding: [
      forward("New field, Portas, Pontevedra, ES", "ES", portasCandidates),
      geocodingUnavailable({
        direction: "reverse",
        latitude: savedEdition.latitude,
        longitude: savedEdition.longitude,
      }),
      forward(
        "Portas, Pontevedra, Spain",
        "ES",
        portasCandidates,
        "Locality response captured in the 2026-10-26 PortAmérica v6 ingestion run; reused from cemetery-correction.json. It does not identify the new venue.",
      ),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.5639366,
        longitude: -8.6570848,
        precision: "locality",
      }),
      ...movedVenue(target),
      replacePoint(target),
    ];
  },
};
