import { expect, test } from "vitest";
import type { MainScore } from "./main";
import { createEvalScorers } from "./scorers";

const scorers = createEvalScorers(true) as Extract<
  ReturnType<typeof createEvalScorers>,
  { required: object }
>;

const quality: MainScore = {
  required: { correct: 1, expected: 2, score: 0.5 },
  additional: { correct: 1, expected: 4, score: 0.25 },
  checks: [],
  conditions: [{ path: "publication", passed: false, message: "Still draft" }],
  errorCount: 0,
  noCheckedErrors: 1,
  passed: false,
};

test.each([
  ["required", 0.5],
  ["additional", 0.25],
  ["accuracy", 1],
  ["scenario", 0],
] as const)("%s adapter exposes its own metric", async (kind, score) => {
  const result = await scorers[kind].run({
    input: { caseId: "test" },
    output: { quality },
  });
  expect(result.score).toBe(score);
});

test.each(["required", "additional"] as const)(
  "%s completeness is N/A when it has no expected facts",
  async (kind) => {
    const result = await scorers[kind].run({
      input: { caseId: "test" },
      output: {
        quality: {
          ...quality,
          [kind]: { correct: 0, expected: 0, score: null },
        },
      },
    });
    expect(result.notScorable).toMatchObject({ reason: "No expected facts" });
  },
);
