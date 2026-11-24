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
    latitude: details.latitude,
    longitude: details.longitude,
    label: details.label,
    objectType: details.objectType,
    placeId: details.placeId ?? null,
    name: details.name ?? null,
    countryCode: details.countryCode ?? null,
    locality: details.locality ?? null,
    address: details.address ?? null,
    originalType: details.originalType ?? null,
    category: details.category ?? null,
    confidence: details.confidence ?? null,
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
  { latitude, longitude }: Point,
  nearby: GeoCandidate | null,
  distanceKm: number | null,
  provenance?: string,
): GeocodingFixture {
  return {
    request: { direction: "reverse", latitude, longitude },
    response: {
      status: "success",
      direction: "reverse",
      queriedPoint: { latitude, longitude },
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
