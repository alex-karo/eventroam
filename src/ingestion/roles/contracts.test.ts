import { expect, it } from "vitest";
import { generalOutputSchema, refreshGeneralOutputSchema } from "./contracts";

it("allows duplicate adds but excludes a duplicate decision during refresh", () => {
  const duplicate = {
    decision: "duplicate",
    eventId: "existing",
    observedEventName: "Festival",
    reason: "Official identity matches",
    evidenceIds: ["s1-e1"],
  };
  expect(generalOutputSchema.safeParse(duplicate).success).toBe(true);
  expect(refreshGeneralOutputSchema.safeParse(duplicate).success).toBe(false);
  expect(
    refreshGeneralOutputSchema.safeParse({
      decision: "uncertain",
      reason: "Source identity is unclear",
      unresolved: [],
    }).success,
  ).toBe(true);
});
