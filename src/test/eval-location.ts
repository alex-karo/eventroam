import { fixtureLocationPlan } from "@/test/ingestion";
import type { LocationEvalCase } from "@/ingestion/evals/fixtures";
import type { LocationInput } from "@/ingestion/location/input";
import type {
  Precision,
  RegisteredPoint,
} from "@/ingestion/location/contracts";
type Prompt = LocationInput & { points: RegisteredPoint[] };
/** Explicit fixture choices test integration, not model accuracy. */
export async function locationDecision(
  item: LocationEvalCase,
  prompt: Prompt,
  geocode: (query: {
    query: string;
    countryCode: string | null;
  }) => Promise<unknown>,
) {
  const plan = fixtureLocationPlan(prompt);
  if (plan.decision.status !== "ready") {
    throw new Error("Fixture must be ready");
  }
  const target = plan.decision.currentOrNextEdition!;
  if (item.location.group === "preservation") {
    return plan;
  }
  const point = item.expectations.required.find(
    (assertion) => assertion.field === "coordinates",
  )!.value as {
    latitude: number;
    longitude: number;
    precision: Precision;
  };
  if (point == null || point.precision === "locality") {
    target.unresolved.push({
      field: "coordinates",
      message: "The venue point is not resolved by the supplied evidence",
    });
  }
  if (point == null) {
    target.coordinates = {
      action: "clear",
      reason: "The move disproves the old point and no replacement applies",
    };
    return plan;
  }
  let found = prompt.points.find(
    (candidate) =>
      candidate.latitude === point.latitude &&
      candidate.longitude === point.longitude,
  );
  if (!found) {
    const fixture = item.geocoding!.find(
      (fixture) =>
        fixture.response.status === "success" &&
        fixture.response.direction === "forward" &&
        fixture.response.candidates.some(
          (candidate) =>
            candidate.latitude === point.latitude &&
            candidate.longitude === point.longitude,
        ),
    )!;
    if (fixture.request.direction !== "forward") {
      throw new Error("Expected forward fixture");
    }
    const result = (await geocode({
      query: fixture.request.query,
      countryCode: fixture.request.countryCode,
    })) as {
      points: RegisteredPoint[];
    };
    found = result.points.find(
      (candidate) =>
        candidate.latitude === point.latitude &&
        candidate.longitude === point.longitude,
    );
  }
  if (!found) {
    throw new Error("Expected registered point");
  }
  if (found.kind === "donor") {
    target.coordinates = {
      action: "inherit",
      donorPointId: found.id,
      reason: "The historical venue point applies to this Edition",
    };
    return plan;
  }
  target.coordinates = {
    action: "select",
    pointId: found.id,
    precision: point.precision,
    reason: "Fixture identifies the supported point",
  };
  if (item.id === "location-official-venue-point") {
    target.unresolved.push({
      field: "coordinates",
      message:
        "The official venue point differs from saved history; supplied evidence does not explain the distance or disprove the official point",
    });
  }
  return plan;
}
