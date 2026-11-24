import type { LocationCaseDefinition } from "../../location";
import { pointChanged, pointQuestion, replacePoint } from "./assertions";
import { forward, geocodingUnavailable } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  movedFieldInput,
  movedVenue,
  moveEventId,
  savedEdition,
} from "./moved-field";

export const locationMoveWithoutPointCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-move-without-point",
    suite: "regression",
    origin: "synthetic",
    task: "Check location move without point",
    provenance: {
      kind: "synthetic",
      note: "A synthetic move uses captured provider results for a city fallback. It tests contract and policy coverage, not a real festival move. The locality refinement is a synthetic empty result, so this case has no applicable city fallback.",
    },
    input: refreshInput(moveEventId),
    location: {
      group: "correction",
      input: movedFieldInput(),
    },
    geocoding: [
      forward("New field, Portas, Pontevedra, ES", "ES", []),
      geocodingUnavailable({
        direction: "reverse",
        latitude: savedEdition.latitude,
        longitude: savedEdition.longitude,
      }),
      forward("Portas, Pontevedra, Spain", "ES", []),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, null),
      ...movedVenue(target),
      replacePoint(target),
    ];
  },
};
