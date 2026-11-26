import { expect, it } from "vitest";
import { drinkClassificationCases } from "./cases/drink-topics";
import { scoreClassification } from "./classification";

it.each([
  { topics: [], passed: true },
  { topics: ["catalog:term:topic:beer"], passed: true },
  { topics: ["validation:music"], passed: false },
  { topics: ["catalog:term:topic:beer", "validation:music"], passed: false },
])(
  "scores topics $topics for the earlier beer programme",
  async ({ topics, passed }) => {
    const item = drinkClassificationCases().find(
      ({ id }) => id === "classification-beer-other-edition",
    )!;
    const { score } = await scoreClassification(
      item,
      {
        status: "success",
        model: "fixture",
        promptVersion: "fixture",
        modelResponse: null,
        errors: [],
        durationMs: 0,
        output: {
          previousEdition: null,
          currentOrNextEdition: {
            classification: {
              action: "set",
              value: ["validation:festival", ...topics],
              reason: "The event name and earlier programme support the topic.",
              evidenceIds: ["e1", "e2"],
            },
          },
          checks: [],
          unresolved: [],
        },
      },
      [
        {
          id: "validation:festival",
          facet: "event_type",
          slug: "festival",
          parentId: null,
        },
        {
          id: "catalog:term:topic:beer",
          facet: "topic",
          slug: "beer",
          parentId: null,
        },
        {
          id: "validation:music",
          facet: "topic",
          slug: "music",
          parentId: null,
        },
      ],
    );

    expect(score.passed).toBe(passed);
  },
);

it("reports duplicate model assignments as a failed check when no categories are allowed", async () => {
  const item = drinkClassificationCases().find(
    ({ id }) => id === "classification-wine-name-only",
  )!;
  const wine = "catalog:term:topic:wine";
  const { score } = await scoreClassification(
    item,
    {
      status: "success",
      model: "fixture",
      promptVersion: "fixture",
      modelResponse: null,
      errors: [],
      durationMs: 0,
      output: {
        previousEdition: null,
        currentOrNextEdition: {
          classification: {
            action: "set",
            value: [wine, wine],
            reason: "The festival name mentions wine.",
            evidenceIds: ["e1"],
          },
        },
        checks: [],
        unresolved: [],
      },
    },
    [{ id: wine, facet: "topic", slug: "wine", parentId: null }],
  );

  expect(score).toEqual({
    passed: false,
    checks: [
      expect.objectContaining({ path: "execution", passed: true }),
      {
        path: "currentOrNextEdition.classification",
        passed: false,
        message: expect.stringContaining("Duplicate classification term"),
      },
    ],
  });
});
