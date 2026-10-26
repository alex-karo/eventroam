import got from "got";
import { z } from "zod";
import { distanceKm } from "../../location/geometry";
import type {
  GeoCandidate,
  GeocodingRequest,
  GeocodingResult,
  GeocodingClient,
} from "./contracts";
const rawPoint = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  formatted: z.string().optional(),
  name: z.string().optional(),
  place_id: z.string().optional(),
  country_code: z.string().optional(),
  city: z.string().optional(),
  town: z.string().optional(),
  village: z.string().optional(),
  address_line1: z.string().optional(),
  result_type: z.string().optional(),
  category: z.string().optional(),
  rank: z.object({ confidence: z.number().optional() }).optional(),
});
const responseSchema = z.object({ results: z.array(rawPoint).max(100) });
function normalize(raw: z.infer<typeof rawPoint>): GeoCandidate {
  const type = raw.result_type;
  const objectType = normalizedObjectType(type);
  return {
    latitude: raw.lat,
    longitude: raw.lon,
    placeId: raw.place_id?.slice(0, 1000) ?? null,
    label: (raw.formatted ?? raw.name ?? "Unnamed result").slice(0, 1200),
    name: raw.name?.slice(0, 500) ?? null,
    countryCode: raw.country_code?.toUpperCase() ?? null,
    locality: (raw.city ?? raw.town ?? raw.village)?.slice(0, 500) ?? null,
    address: raw.address_line1?.slice(0, 1200) ?? null,
    objectType,
    originalType: type?.slice(0, 100) ?? null,
    category: raw.category?.slice(0, 200) ?? null,
    confidence: raw.rank?.confidence ?? null,
  };
}
export function parseGeoapify(
  request: GeocodingRequest,
  response: { status: number; body: unknown },
): GeocodingResult {
  if (response.status === 429) {
    return { status: "error", code: "rate_limited" };
  }
  if ([401, 403].includes(response.status)) {
    return { status: "error", code: "unavailable" };
  }
  if (response.status !== 200) {
    return { status: "error", code: "provider_error" };
  }
  const parsed = responseSchema.safeParse(response.body);
  if (!parsed.success) {
    return { status: "error", code: "invalid_response" };
  }
  const candidates = parsed.data.results
    .slice(0, request.direction === "forward" ? 3 : 1)
    .map(normalize);
  if (request.direction === "forward") {
    return {
      status: "success",
      direction: "forward",
      candidates: candidates.filter(
        (candidate) =>
          !request.countryCode || candidate.countryCode === request.countryCode,
      ),
    };
  }
  const nearby = candidates[0] ?? null;
  return {
    status: "success",
    direction: "reverse",
    queriedPoint: { latitude: request.latitude, longitude: request.longitude },
    nearby,
    distanceKm: nearby ? distanceKm(request, nearby) : null,
  };
}
export function geoapifyTransport(apiKey: string) {
  return async (request: GeocodingRequest, signal: AbortSignal) => {
    const url = new URL(
      `https://api.geoapify.com/v1/geocode/${request.direction === "forward" ? "search" : "reverse"}`,
    );
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", request.direction === "forward" ? "3" : "1");
    if (request.direction === "forward") {
      url.searchParams.set("text", request.query);
      if (request.countryCode) {
        url.searchParams.set(
          "filter",
          `countrycode:${request.countryCode.toLowerCase()}`,
        );
      }
    } else {
      url.searchParams.set("lat", String(request.latitude));
      url.searchParams.set("lon", String(request.longitude));
    }
    const abort = new AbortController();
    const combined = AbortSignal.any([signal, abort.signal]);
    const response = await got(url, {
      retry: { limit: 0 },
      followRedirect: false,
      throwHttpErrors: false,
      signal: combined,
      responseType: "buffer",
      headers: { accept: "application/json" },
    }).on("downloadProgress", ({ transferred, total }) => {
      if (transferred > 256 * 1024 || (total ?? 0) > 256 * 1024) {
        abort.abort();
      }
    });
    try {
      return {
        status: response.statusCode,
        body: JSON.parse(Buffer.from(response.body).toString("utf8")),
      };
    } catch {
      return { error: "invalid_response" as const };
    }
  };
}
export async function geocode(
  request: GeocodingRequest,
  options: {
    apiKey?: string;
    signal: AbortSignal;
    client?: GeocodingClient;
  },
): Promise<GeocodingResult> {
  if (options.signal.aborted) {
    return {
      status: "error",
      code:
        options.signal.reason?.name === "TimeoutError"
          ? "timeout"
          : "cancelled",
    };
  }
  if (!options.client && !options.apiKey) {
    return { status: "error", code: "unavailable" };
  }
  try {
    if (options.client) {
      return await options.client(request, options.signal);
    }
    const response = await geoapifyTransport(options.apiKey!)(
      request,
      options.signal,
    );
    return "error" in response
      ? { status: "error", code: response.error! }
      : parseGeoapify(request, response);
  } catch {
    return {
      status: "error",
      code: abortCode(options.signal),
    };
  }
}

function normalizedObjectType(type?: string): GeoCandidate["objectType"] {
  if (type && ["amenity", "building"].includes(type)) {
    return "venue";
  }
  if (type && ["city", "town", "village", "municipality"].includes(type)) {
    return "locality";
  }
  if (type && ["state", "county", "region", "country"].includes(type)) {
    return "region";
  }
  return "unknown";
}
function abortCode(signal: AbortSignal) {
  if (!signal.aborted) {
    return "network_error" as const;
  }
  return signal.reason?.name === "TimeoutError"
    ? ("timeout" as const)
    : ("cancelled" as const);
}
