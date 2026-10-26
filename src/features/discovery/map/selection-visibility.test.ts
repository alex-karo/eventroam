import { expect, test } from "vitest";
import { selectionOffset } from "./selection-visibility";
const viewport = { left: 400, right: 1400, top: 50, bottom: 850 };
test("selection moves only enough to leave the actual side or bottom card", () => {
  expect(
    selectionOffset({ x: 600, y: 400 }, viewport, {
      left: 1000,
      right: 1380,
      top: 110,
      bottom: 750,
    }),
  ).toEqual({ x: 0, y: 0 });
  expect(
    selectionOffset({ x: 1200, y: 400 }, viewport, {
      left: 1000,
      right: 1380,
      top: 110,
      bottom: 750,
    }),
  ).toEqual({ x: 239, y: 0 });
  expect(
    selectionOffset({ x: 1200, y: 90 }, viewport, {
      left: 1000,
      right: 1380,
      top: 130,
      bottom: 750,
    }),
  ).toEqual({ x: 0, y: 0 });
  expect(
    selectionOffset({ x: 1200, y: 140 }, viewport, {
      left: 1000,
      right: 1380,
      top: 130,
      bottom: 750,
    }),
  ).toEqual({ x: 0, y: 49 });
  expect(
    selectionOffset({ x: 600, y: 750 }, viewport, {
      left: 410,
      right: 1390,
      top: 600,
      bottom: 840,
    }),
  ).toEqual({ x: 0, y: 189 });
});
