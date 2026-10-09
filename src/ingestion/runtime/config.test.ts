import { expect, test } from "vitest";
import { loadResearchConfig } from "./config";

test("Flex routing is the default unless standard is explicitly requested", () => {
  const base = { NODE_ENV: "test" as const, OPENROUTER_API_KEY: "test-key" };
  expect(loadResearchConfig(base).serviceTier).toBe("flex");
  for (const value of ["", "   ", " flex "]) {
    expect(
      loadResearchConfig({ ...base, OPENROUTER_SERVICE_TIER: value })
        .serviceTier,
    ).toBe("flex");
  }
  expect(
    loadResearchConfig({
      ...base,
      OPENROUTER_SERVICE_TIER: "flex",
    }).serviceTier,
  ).toBe("flex");
  expect(
    loadResearchConfig({ ...base, OPENROUTER_SERVICE_TIER: "standard" })
      .serviceTier,
  ).toBeUndefined();
  expect(() =>
    loadResearchConfig({ ...base, OPENROUTER_SERVICE_TIER: "priority" }),
  ).toThrow("OPENROUTER_SERVICE_TIER must be flex or standard");
});
