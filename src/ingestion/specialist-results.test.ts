import { expect, test } from "vitest";
import { specialistResultsSchema } from "./specialist-results";
import { emptyLocationExecution } from "./roles/location/execution";
import { specialistJoinInputSchema } from "./workflow-step-schemas";
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

test("keeps the original join input for diagnosis", () => {
  const malformed = {
    ...branches(),
    tickets: { ...idle, status: "success", raw: { details: ["invalid"] } },
  };
  expect(specialistJoinInputSchema.parse(malformed)).toEqual(malformed);
  expect(specialistResultsSchema.safeParse(malformed).success).toBe(false);

  const failed = {
    ...branches(),
    tickets: {
      ...idle,
      status: "failed",
      modelResponse: { text: null, object: { tickets: "invalid" } },
      output: null,
    },
  };
  expect(specialistJoinInputSchema.parse(failed)).toEqual(failed);
  expect(specialistResultsSchema.parse(failed).tickets).toEqual({
    ...idle,
    status: "failed",
    modelResponse: failed.tickets.modelResponse,
  });
});
