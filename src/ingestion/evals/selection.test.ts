import { expect, test } from "vitest";
import { loadEvalSuite } from "./fixtures";
import { caseGroup, selectEvalCases } from "./selection";

test("all 50 cases have independent suite, origin and task metadata", () => {
  const suite = loadEvalSuite();
  expect(selectEvalCases(suite, {})).toHaveLength(5);
  expect(selectEvalCases(suite, { all: true })).toHaveLength(50);
  expect(
    Object.fromEntries(
      [
        "main/pipeline",
        "regression/pipeline",
        "regression/editor",
        "regression/location",
      ].map((group) => [
        group,
        suite.cases.filter((c) => caseGroup(c) === group).length,
      ]),
    ),
  ).toEqual({
    "main/pipeline": 5,
    "regression/pipeline": 25,
    "regression/editor": 7,
    "regression/location": 13,
  });
  expect(selectEvalCases(suite, { editorOnly: true })).toHaveLength(7);
  expect(selectEvalCases(suite, { locationOnly: true })).toHaveLength(13);
  expect(
    new Set(suite.cases.flatMap((c) => (c.location ? [c.location.group] : []))),
  ).toEqual(new Set(["completion", "correction", "preservation"]));
  expect(suite.cases.every((c) => c.task && c.origin)).toBe(true);
  expect(() =>
    selectEvalCases(suite, { caseIds: ["wacken"], editorOnly: true }),
  ).toThrow("incompatible");
});
