import { isDeepStrictEqual as same } from "node:util";
import { check } from "../../checks";
import type { LocationCaseDefinition } from "../../location";
import { pointChanged, pointQuestion, pointAction } from "./assertions";
import { locationInput, locationEvidence } from "./fixture";
import { forward, reverse } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  lisbonCandidates,
  riverParkEvidence,
  riverParkTarget,
  nearbyKiosk,
} from "./river-park-replay";

const editionKey = "2027";
const caseName = "official-venue-point";
const announcement =
  "The official 2027 page identifies River Park in Lisbon, Portugal.";

export const locationOfficialVenuePointCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-official-venue-point",
    suite: "regression",
    origin: "synthetic",
    task: "Check location official venue point",
    provenance: {
      kind: "synthetic",
      note: "Explicit official venue coordinates differ by more than 10 km from the saved target and historical donor. Geocoding returns only a locality. The official point must take priority and the unexplained discrepancy must remain unresolved. All source and provider data are synthetic.",
    },
    input: refreshInput(`event-${caseName}`),
    location: {
      group: "correction",
      input: locationInput(
        riverParkTarget(caseName, {
          latitude: 38.71,
          longitude: -9.14,
          coordinatePrecision: "approximate",
        }),
        {
          festival: {
            name: `River Festival ${caseName}`,
            summary: "An open-air music festival.",
            format: ["openair"],
          },
          countryBaseline: "PT",
          sources: [
            {
              url: "https://fixture.test/official-venue-point/2027/location",
              information:
                "The festival's official 2027 location page identifies River Park in Lisbon, Portugal, as the venue and gives its GPS point as 38.83, -9.16.",
            },
          ],
          evidence: [
            ...riverParkEvidence(announcement),
            locationEvidence(
              editionKey,
              4,
              'coordinates: {"latitude": 38.83, "longitude": -9.16, "precision": "exact"}',
              [
                "The festival's official 2027 location page identifies River Park in Lisbon, Portugal, as the venue and gives its GPS point as 38.83, -9.16.",
              ],
            ),
          ],
        },
      ),
    },
    geocoding: [
      reverse(
        { latitude: 38.71, longitude: -9.14 },
        nearbyKiosk(38.71, -9.14),
        0,
      ),
      forward("River Park, Lisbon, PT", "PT", lisbonCandidates),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("2027");
    return [
      pointChanged(target, {
        latitude: 38.83,
        longitude: -9.16,
        precision: "exact",
      }),
      pointAction(target, "select"),
      pointQuestion(target),
      check(
        "location.previousPoint",
        !target?.coordinatesChanged ||
          !same(target.coordinates, {
            latitude: 38.72,
            longitude: -9.15,
            precision: "locality",
          }),
        "Do not copy the wrong earlier point",
      ),
    ];
  },
};
