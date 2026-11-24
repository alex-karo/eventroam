import type {
  GeoCandidate,
  GeocodingRequest,
  GeocodingResult,
} from "../../tools/geocode/contracts";

type Point = Pick<GeoCandidate, "latitude" | "longitude">;
type GeocodingFixture = {
  request: GeocodingRequest;
  response: GeocodingResult;
  provenance?: string;
};

type Candidate = Pick<
  GeoCandidate,
  "latitude" | "longitude" | "label" | "objectType"
>;

export function candidate(
  details: Candidate & Partial<Omit<GeoCandidate, keyof Candidate>>,
): GeoCandidate {
  return {
    placeId: null,
    name: null,
    countryCode: null,
    locality: null,
    address: null,
    originalType: null,
    category: null,
    confidence: null,
    ...details,
  };
}

export function forward(
  query: string,
  countryCode: string | null,
  candidates: GeoCandidate[],
  provenance?: string,
): GeocodingFixture {
  return {
    request: { direction: "forward", query, countryCode },
    response: { status: "success", direction: "forward", candidates },
    ...(provenance === undefined ? {} : { provenance }),
  };
}

export function reverse(
  queriedPoint: Point,
  nearby: GeoCandidate | null,
  distanceKm: number | null,
  provenance?: string,
): GeocodingFixture {
  return {
    request: { direction: "reverse", ...queriedPoint },
    response: {
      status: "success",
      direction: "reverse",
      queriedPoint,
      nearby,
      distanceKm,
    },
    ...(provenance === undefined ? {} : { provenance }),
  };
}

export function geocodingUnavailable(
  request: GeocodingRequest,
): GeocodingFixture {
  return { request, response: { status: "error", code: "unavailable" } };
}
