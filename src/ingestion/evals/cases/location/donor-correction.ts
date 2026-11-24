import { isDeepStrictEqual as same } from "node:util";
import { check } from "../../checks";
import type { LocationCaseDefinition } from "../../location";
import { pointChanged } from "./assertions";
import { locationInput } from "./fixture";
import { forward, reverse } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  lisbonCandidates,
  riverParkEvidence,
  riverParkTarget,
  nearbyKiosk,
} from "./river-park-replay";

const caseName = "donor-correction";
const announcement =
  "The 2027 saved point was placed at the wrong park. The 2026 point is the official River Park venue; no move occurred.";

export const locationDonorCorrectionCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-donor-correction",
    suite: "regression",
    origin: "synthetic",
    task: "Check location donor correction",
    provenance: {
      kind: "synthetic",
      note: "The 2027 saved point was placed at the wrong park. The 2026 point is the official River Park venue; no move occurred. Provider results are synthetic.",
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
              url: `https://fixture.test/${caseName}`,
              information: announcement,
            },
          ],
          evidence: riverParkEvidence(announcement),
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
        latitude: 38.73,
        longitude: -9.16,
        precision: "approximate",
      }),
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
