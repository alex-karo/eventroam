import { isDeepStrictEqual as same } from "node:util";
import { check } from "../../checks";
import type { LocationCaseDefinition } from "../../location";
import { pointChanged, pointAction } from "./assertions";
import { locationInput } from "./fixture";
import { forward, reverse } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  lisbonCandidates,
  riverParkEvidence,
  riverParkTarget,
  nearbyKiosk,
} from "./river-park-replay";

const caseName = "donor-inheritance";
const announcement =
  "The 2027 Edition is announced at River Park in Lisbon, the same venue as in 2026. The announcement gives no coordinates and reports no venue change.";

export const locationDonorInheritanceCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-donor-inheritance",
    suite: "regression",
    origin: "synthetic",
    task: "Check location donor inheritance",
    provenance: {
      kind: "synthetic",
      note: "The 2027 Edition has no coordinates. It uses the same venue as the 2026 Edition, which has a saved approximate point. Geocoding returns only the city. Inheritance must retain donor precision without claiming fresh verification. Provider results are synthetic.",
    },
    input: refreshInput(`event-${caseName}`),
    location: {
      group: "completion",
      input: locationInput(
        riverParkTarget(caseName, {
          latitude: null,
          longitude: null,
          coordinatePrecision: "unknown",
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
        { latitude: 38.73, longitude: -9.16 },
        nearbyKiosk(38.7301, -9.16),
        0.011,
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
      pointAction(target, "reusePrevious"),
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
