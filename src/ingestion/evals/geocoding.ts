import { isDeepStrictEqual } from "node:util";
import { geocodingKey, type GeocodingClient } from "../tools/geocode/contracts";
import type { EvalCase } from "./fixtures";

function words(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Normalize spelling and country labels without discarding place qualifiers. */
function forwardKey(query: string, countryCode: string | null) {
  const countryNames = new Set<string>();
  if (countryCode) {
    countryNames.add(words(countryCode));
    for (const language of ["en", "es", "pt", "fr", "de"]) {
      const name = new Intl.DisplayNames([language], { type: "region" }).of(
        countryCode,
      );
      if (name) {
        countryNames.add(words(name));
      }
    }
  }
  const text = query
    .split(/[,;|\n]/)
    .map(words)
    .filter((part) => !countryNames.has(part))
    .join(" ");
  return JSON.stringify([
    countryCode,
    text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  ]);
}

export function fixedGeocoding(
  item: Pick<EvalCase, "geocoding">,
): GeocodingClient {
  return async (request) => {
    const exact = item.geocoding?.find(
      (fixture) => geocodingKey(fixture.request) === geocodingKey(request),
    );
    if (exact) {
      return structuredClone(exact.response);
    }

    const matches =
      request.direction === "forward"
        ? (item.geocoding ?? []).filter(
            (fixture) =>
              fixture.request.direction === "forward" &&
              forwardKey(fixture.request.query, fixture.request.countryCode) ===
                forwardKey(request.query, request.countryCode),
          )
        : [];
    const response = matches[0]?.response;
    if (
      response &&
      matches.every((fixture) => isDeepStrictEqual(fixture.response, response))
    ) {
      return structuredClone(response);
    }
    return { status: "error", code: "unavailable" };
  };
}
