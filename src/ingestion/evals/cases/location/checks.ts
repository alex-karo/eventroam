import { isDeepStrictEqual as same } from "node:util";
import { check } from "../../checks";
import type { LocationContext, LocationEvaluator } from "../../location";

type Edition = ReturnType<LocationContext["edition"]>;

function pointChanged(
  edition: Edition,
  expected: NonNullable<Edition>["coordinates"],
) {
  return check(
    "location.coordinates",
    edition?.coordinatesChanged === true && same(edition.coordinates, expected),
    `Change coordinates to ${JSON.stringify(expected)}`,
  );
}

function pointQuestion(edition: Edition) {
  return check(
    "location.unresolved.coordinates",
    edition?.unresolved.some((question) => question.field === "coordinates") ===
      true,
    "Keep an unresolved coordinate question",
  );
}

function pointAction(edition: Edition, action: string) {
  return check(
    "location.coordinateAction",
    edition?.coordinateAction === action,
    `Coordinate action=${action}`,
  );
}

function replacePoint(edition: Edition) {
  return check(
    "location.coordinateAction",
    !!edition && edition.coordinateAction !== "keep",
    "Do not keep the unsupported saved point",
  );
}

function preservePoint(edition: Edition) {
  return [
    pointAction(edition, "keep"),
    check(
      "location.coordinates",
      !!edition && !edition.coordinatesChanged,
      "Preserve the saved point and precision",
    ),
  ];
}

function movedVenue(edition: Edition) {
  return [
    check(
      "location.venueAddress",
      edition?.venueAddress.action === "clear" &&
        edition.saved?.venueAddress != null,
      "Clear the old venue address",
    ),
    check(
      "location.venueName",
      edition?.venueName.action === "set" &&
        edition.venueName.value === "New field" &&
        edition.saved?.venueName !== "New field",
      "Change the venue name to New field",
    ),
  ];
}

export const checks = {
  "location-cemetery": ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.5639366,
        longitude: -8.6570848,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
  "location-bridge": ({ edition }) =>
    preservePoint(edition("warm-up-estrella-de-levante-2027")),
  "location-central-park": ({ edition }) => preservePoint(edition("2027")),
  "location-building-complex": ({ edition }) => {
    const target = edition("hallowindie-2025");
    return [
      pointChanged(target, {
        latitude: 42.5933469,
        longitude: -5.5835976,
        precision: "approximate",
      }),
      replacePoint(target),
    ];
  },
  "location-several-venues": ({ edition }) => {
    const target = edition("ageas-cooljazz-2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 38.6968919,
        longitude: -9.4204495,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
  "location-cemetery-correction": ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.5639366,
        longitude: -8.6570848,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
  "location-move-city-fallback": ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.5639366,
        longitude: -8.6570848,
        precision: "locality",
      }),
      ...movedVenue(target),
      replacePoint(target),
    ];
  },
  "location-move-without-point": ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, null),
      ...movedVenue(target),
      replacePoint(target),
    ];
  },
  "location-saved-precision": ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.579634,
        longitude: -8.669209,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
  "location-target-before-donor": ({ edition }) =>
    preservePoint(edition("2027")),
  "location-donor-correction": ({ edition }) => {
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
  "location-donor-inheritance": ({ edition }) => {
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
  "location-official-venue-point": ({ edition }) => {
    const target = edition("2027");
    return [
      pointChanged(target, {
        latitude: 38.83,
        longitude: -9.16,
        precision: "exact",
      }),
      pointAction(target, "select"),
      pointQuestion(target),
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
} satisfies Record<string, LocationEvaluator>;
