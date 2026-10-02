import { expect, test } from "vitest";
import { testFixtures } from "../test/fixtures";

const { build } = testFixtures();
import { mapFeatures, hasMapPoint } from "./discovery-map";

test("map features retain approximate labels and exclude unlocated summaries", () => {
  const located = build.summary({
    id: "located",
    eventName: "Fictional Festival",
    year: 2027,
    latitude: 38,
    longitude: -9,
    coordinatePrecision: "locality",
    ticketAvailability: "sold_out",
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
          name: "Fictional Festival 2027",
          approximate: true,
          soldOut: true,
        },
      },
    ],
  });
});
