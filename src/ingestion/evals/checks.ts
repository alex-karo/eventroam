export type Check = { path: string; passed: boolean; message: string };

export function check(path: string, passed: boolean, message = path): Check {
  return { path, passed, message };
}

export function scenarioResult(checks: Check[]) {
  return { checks, passed: checks.every((check) => check.passed) };
}

export type ScenarioResult = ReturnType<typeof scenarioResult>;
