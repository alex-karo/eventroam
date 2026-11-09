import { expect, test } from "vitest";
import { locationFailureMessage } from "./failure";

test.each([NaN, Infinity, 399, 600, 503.5, "503", "secret"])(
  "Location omits invalid HTTP status %s and arbitrary error fields",
  (statusCode) => {
    const error = {
      name: "secret",
      code: "secret",
      statusCode,
      data: { metadata: { error_type: "secret" } },
    };
    expect(locationFailureMessage(error)).toBe(
      "Location execution or validation failed (type=unknown)",
    );
  },
);

test("Location bounds cause inspection and stops at cycles", () => {
  const cycle = Object.assign(new Error("secret"), { cause: {} });
  cycle.cause = cycle;
  expect(locationFailureMessage(cycle)).toBe(
    "Location execution or validation failed (type=error)",
  );
  let deep: unknown = { name: "AI_APICallError", statusCode: 503 };
  for (let depth = 0; depth < 5; depth++) {
    deep = { cause: deep };
  }
  expect(locationFailureMessage(deep)).toBe(
    "Location execution or validation failed (type=unknown)",
  );
});
