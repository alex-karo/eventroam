export type Check = { path: string; passed: boolean; message: string };

export function check(path: string, passed: boolean, message = path): Check {
  return { path, passed, message };
}

export function scenarioResult(checks: Check[]) {
  return { checks, passed: checks.every((check) => check.passed) };
}

export type ScenarioResult = ReturnType<typeof scenarioResult>;

/** Match the supplied part of a finding, or one member of a collection. */
export function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    return actual.some((value) => contains(value, expected));
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") {
      return false;
    }
    return Object.entries(expected).every(([key, value]) =>
      contains((actual as Record<string, unknown>)[key], value),
    );
  }
  return Object.is(actual, expected);
}
