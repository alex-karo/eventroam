import { describe, expect, it } from "vitest";
import { createResearchBudget, ResearchLimitError } from "./budget";

describe("research budget", () => {
  it("shares limits across calls and keeps spent capacity after failure", () => {
    let current = 0;
    const budget = createResearchBudget(
      { searches: 1, durationMs: 100 },
      () => current,
    );
    budget.consumeSearch();
    budget.consumePage(2);
    budget.consumeModelCall(10);
    expect(() => budget.consumeSearch()).toThrow(ResearchLimitError);
    budget.consumePage(2);
    budget.consumeModelCall(10);
    expect(budget.snapshot()).toMatchObject({
      searches: 1,
      pages: 2,
      modelCalls: 2,
    });
    current = 100;
    expect(() => budget.assertTime()).toThrow(ResearchLimitError);
  });

  it("counts reads beyond the former 20-page cap", () => {
    const budget = createResearchBudget();
    for (let index = 0; index < 25; index += 1) {
      budget.consumePage();
    }
    expect(budget.snapshot().pages).toBe(25);
  });
});
