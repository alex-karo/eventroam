import { expect, test } from "vitest";
import { loadResearchConfig } from "./config";

test("Flex routing is opt-in through the research environment", () => {
  const base = { NODE_ENV: "test" as const, OPENROUTER_API_KEY: "test-key" };
  expect(loadResearchConfig(base).serviceTier).toBeUndefined();
  expect(
    loadResearchConfig({
      ...base,
      OPENROUTER_SERVICE_TIER: "flex",
    }).serviceTier,
  ).toBe("flex");
  expect(() =>
    loadResearchConfig({ ...base, OPENROUTER_SERVICE_TIER: "priority" }),
  ).toThrow("OPENROUTER_SERVICE_TIER must be flex or empty");
});
