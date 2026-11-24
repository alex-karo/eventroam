import { isDeepStrictEqual as same } from "node:util";
import { check } from "../../checks";
import type { LocationContext } from "../../location";

type Edition = ReturnType<LocationContext["edition"]>;

export function pointChanged(
  edition: Edition,
  expected: NonNullable<Edition>["coordinates"],
) {
  return check(
    "location.coordinates",
    edition?.coordinatesChanged === true && same(edition.coordinates, expected),
    `Change coordinates to ${JSON.stringify(expected)}`,
  );
}

export function pointQuestion(edition: Edition) {
  return check(
    "location.unresolved.coordinates",
    edition?.unresolved.some((question) => question.field === "coordinates") ===
      true,
    "Keep an unresolved coordinate question",
  );
}

export function pointAction(edition: Edition, action: string) {
  return check(
    "location.coordinateAction",
    edition?.coordinateAction === action,
    `Coordinate action=${action}`,
  );
}

export function replacePoint(edition: Edition) {
  return check(
    "location.coordinateAction",
    !!edition && edition.coordinateAction !== "keep",
    "Do not keep the unsupported saved point",
  );
}

export function preservePoint(edition: Edition) {
  return [
    pointAction(edition, "keep"),
    check(
      "location.coordinates",
      !!edition && !edition.coordinatesChanged,
      "Preserve the saved point and precision",
    ),
  ];
}
