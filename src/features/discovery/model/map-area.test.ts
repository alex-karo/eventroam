import { expect, test } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { filterMapArea } from "./map-area";

test("area filtering includes edges, keeps order, and excludes missing coordinates", () => {
  const { build } = testFixtures();
  const rows = [
    build.summary({ id: "north", latitude: 40, longitude: 0 }),
    build.summary({ id: "outside", latitude: 35, longitude: 1 }),
    build.summary({ id: "south", latitude: 30, longitude: -10 }),
    build.summary({ latitude: null, longitude: 0 }),
    build.summary({ latitude: 35, longitude: null }),
    build.summary({ latitude: 41, longitude: -5 }),
  ];
  expect(
    filterMapArea(rows, { west: -10, east: 0, south: 30, north: 40 }),
  ).toEqual([rows[0], rows[2]]);
});

test.each([170, -190, 530])(
  "date-line bounds at %s match longitude copies once",
  (west) => {
    const { build } = testFixtures();
    const rows = [
      build.summary({ latitude: 0, longitude: 179 }),
      build.summary({ latitude: 0, longitude: -179 }),
      build.summary({ latitude: 0, longitude: 0 }),
    ];
    expect(
      filterMapArea(rows, { west, east: west + 20, south: -10, north: 10 }),
    ).toEqual(rows.slice(0, 2));
  },
);

test.each([360, 720])(
  "a %s degree area includes all longitudes but keeps latitude limits",
  (width) => {
    const { build } = testFixtures();
    const rows = [
      build.summary({ latitude: 0, longitude: -179 }),
      build.summary({ latitude: 0, longitude: 180 }),
      build.summary({ latitude: 20, longitude: 0 }),
      build.summary({ latitude: null, longitude: null }),
    ];
    expect(
      filterMapArea(rows, {
        west: 10,
        east: 10 + width,
        south: -10,
        north: 10,
      }),
    ).toEqual(rows.slice(0, 2));
  },
);
