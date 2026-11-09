import type { LocationExecution } from "../roles/location/agent";
import type { LocationOutput } from "../roles/location/contracts";
import type { LocationTarget } from "../roles/location/input";
import type { MaterializedLocation } from "../roles/location/validate";
import type { LocationEvalCase } from "./fixtures";
import type { Check } from "./checks";
import { checks } from "./cases/location/checks";

type Point = { latitude: number; longitude: number; precision: string };

function finalCoordinates(
  target: LocationTarget,
  action: NonNullable<
    MaterializedLocation["slots"]["currentOrNextEdition"]
  >["coordinates"],
): Point | null {
  if (action.action === "set") {
    return action.value;
  }
  if (action.action === "clear" || target.saved?.latitude == null) {
    return null;
  }
  return {
    latitude: target.saved.latitude,
    longitude: target.saved.longitude!,
    precision: target.saved.coordinatePrecision,
  };
}

function locationContext(item: LocationEvalCase, execution: LocationExecution) {
  const output = execution.modelResponse?.object as LocationOutput | undefined;
  return {
    edition: (key: string) => {
      for (const slot of ["previousEdition", "currentOrNextEdition"] as const) {
        const target = item.location.input[slot];
        const fields = execution.materialized?.slots[slot];
        if (target?.editionKey !== key || !fields) {
          continue;
        }
        const coordinates = finalCoordinates(target, fields.coordinates);
        return {
          coordinates,
          coordinatesChanged:
            fields.coordinates.action !== "keep" &&
            (coordinates?.latitude !== target.saved?.latitude ||
              coordinates?.longitude !== target.saved?.longitude ||
              coordinates?.precision !== target.saved?.coordinatePrecision),
          coordinateAction:
            output?.decision.status === "ready"
              ? output.decision[slot]?.coordinates.action
              : undefined,
          venueName: fields.venueName,
          venueAddress: fields.venueAddress,
          saved: target.saved,
          unresolved:
            execution.materialized?.unresolved.filter(
              (question) => question.editionKey === key,
            ) ?? [],
        };
      }
    },
  };
}

export type LocationContext = ReturnType<typeof locationContext>;
export type LocationEvaluator = (context: LocationContext) => Check[];

export function assertLocationCase(item: LocationEvalCase) {
  if (!Object.hasOwn(checks, item.id)) {
    throw new Error(
      `Regression case needs a registered Location evaluator: ${item.id}`,
    );
  }
}

export function checkLocationCase(
  item: LocationEvalCase,
  execution: LocationExecution,
) {
  return checks[item.id as keyof typeof checks](
    locationContext(item, execution),
  );
}
