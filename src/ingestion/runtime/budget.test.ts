import { describe, expect, it } from "vitest";
import { createResearchBudget, ResearchLimitError } from "./budget";

describe("research budget", () => {
  it("shares limits across calls and keeps spent capacity after failure", () => {
    let current = 0;
    const budget = createResearchBudget(
      { searches: 1, pages: 1, modelCalls: 1, durationMs: 100 },
      () => current,
    );
    budget.consumeSearch();
    budget.consumePage(2);
    budget.consumeModelCall(10);
    expect(() => budget.consumeSearch()).toThrow(ResearchLimitError);
    expect(budget.snapshot()).toMatchObject({
      searches: 1,
      pages: 1,
      modelCalls: 1,
    });
    current = 100;
    expect(() => budget.assertTime()).toThrow(ResearchLimitError);
  });
});
