import type { LocationCaseDefinition } from "../../location";
import { preservePoint } from "./assertions";
import { locationInput } from "./fixture";
import { forward, reverse } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  lisbonCandidates,
  riverParkEvidence,
  riverParkTarget,
  nearbyKiosk,
} from "./river-park-replay";

const caseName = "target-before-donor";
const announcement =
  "The festival moved from the 2026 park to River Park in 2027. The saved 2027 point is the official current venue. The historical point no longer applies.";

export const locationTargetBeforeDonorCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-target-before-donor",
    suite: "regression",
    origin: "synthetic",
    task: "Check location target before donor",
    provenance: {
      kind: "synthetic",
      note: "The festival moved from the 2026 park to River Park in 2027. The saved 2027 point is the official current venue. The historical point no longer applies. Provider results are synthetic.",
    },
    input: refreshInput(`event-${caseName}`),
    location: {
      group: "preservation",
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
  evaluate: ({ edition }) => preservePoint(edition("2027")),
};
