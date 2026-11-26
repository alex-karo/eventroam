import { expect, it } from "vitest";
import { drinkClassificationCases } from "./cases/drink-topics";
import { scoreClassification } from "./classification";

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
