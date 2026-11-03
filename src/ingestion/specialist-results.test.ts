import { expect, test } from "vitest";
import { specialistResultsSchema } from "./specialist-results";
import { emptyLocationExecution } from "./location/execution";
const idle = {
  status: "not_run",
  errors: [],
  modelResponse: null,
  model: "fixture",
  promptVersion: "fixture",
  durationMs: 0,
};
const branches = () => ({
  tickets: idle,
  classification: idle,
  links: idle,
  location: emptyLocationExecution(),
});
test("rejects missing and malformed branch results before use", () => {
  const missing: Record<string, unknown> = branches();
  delete missing.location;
  expect(specialistResultsSchema.safeParse(missing).success).toBe(false);
  expect(
    specialistResultsSchema.safeParse({
      ...branches(),
      tickets: { ...idle, status: "success" },
    }).success,
  ).toBe(false);
});
