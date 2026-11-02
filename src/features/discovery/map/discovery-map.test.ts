import { expect, test } from "vitest";
import { testFixtures } from "@/test/fixtures";

const { build } = testFixtures();
import {
  mapFeatures,
  hasMapPoint,
  mapBounds,
} from "@/features/discovery/map/discovery-map";

test("map features retain point identity and exclude unlocated summaries", () => {
  const located = build.summary({
    id: "located",
    latitude: 38,
    longitude: -9,
  });
  const unlocated = build.summary({
    id: "unlocated",
    latitude: null,
    longitude: null,
  });
  expect(hasMapPoint(unlocated)).toBe(false);
  expect(mapFeatures([located, unlocated])).toEqual({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "located",
        geometry: { type: "Point", coordinates: [-9, 38] },
        properties: {
          id: "located",
        },
      },
    ],
  });
});

test("map bounds keep dates-line neighbors together and ignore unlocated editions", () => {
  const eastern = build.summary({ latitude: 2, longitude: 179 });
  const western = build.summary({ latitude: -3, longitude: -179 });
  const unlocated = build.summary({ latitude: null, longitude: null });
  expect(mapBounds([eastern, western, unlocated])).toEqual({
    west: 179,
    east: 181,
    south: -3,
    north: 2,
  });
  expect(mapBounds([unlocated])).toBeNull();
});
