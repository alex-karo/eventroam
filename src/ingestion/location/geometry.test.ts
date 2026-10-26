import { expect, test } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { distanceKm, previousPoint } from "./geometry";

test("measures known distances, including the date line and opposite points", () => {
  const origin = { latitude: 0, longitude: 0 };
  expect(distanceKm(origin, origin)).toBe(0);
  expect(distanceKm(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(
    111.195,
    2,
  );
  expect(
    distanceKm(
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 },
    ),
  ).toBeCloseTo(222.39, 2);
  expect(distanceKm(origin, { latitude: 0, longitude: 180 })).toBeCloseTo(
    20015.114,
    2,
  );
});

test("uses dates within one year and rejects tied or unrelated baselines", () => {
  const fx = testFixtures();
  const event = fx.event();
  const point = {
    latitude: 39,
    longitude: -8,
    coordinatePrecision: "approximate" as const,
  };
  const first = fx.edition(event, { ...point, startsOn: "2026-02-01" });
  const latest = fx.edition(event, { ...point, startsOn: "2026-05-01" });
  const target = fx.edition(event, { startsOn: "2026-08-01" });
  const future = fx.edition(event, { ...point, startsOn: "2027-01-01" });
  const other = fx.edition(fx.event(), { ...point, startsOn: "2026-07-01" });
  expect(
    previousPoint(target, [first, latest, target, future, other])?.id,
  ).toBe(latest.id);
  const tied = fx.edition(event, { ...point, startsOn: "2026-05-01" });
  expect(previousPoint(target, [first, latest, tied])).toBeNull();
});

test("uses year order only when dates are absent", () => {
  const fx = testFixtures();
  const event = fx.event();
  const old = fx.edition(event, {
    startsOn: null,
    endsOn: null,
    editionYear: 2025,
    latitude: 0,
    longitude: 0,
    coordinatePrecision: "approximate",
  });
  const target = fx.edition(event, {
    startsOn: null,
    endsOn: null,
    editionYear: 2027,
  });
  expect(previousPoint(target, [old])?.id).toBe(old.id);
});
