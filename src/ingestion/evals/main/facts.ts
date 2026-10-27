import { isDeepStrictEqual as same } from "node:util";

type Fact = {
  path: string;
  status: "correct" | "missing" | "wrong";
  note: string;
};
type Condition = { path: string; passed: boolean; message: string };

function missing(value: unknown) {
  return (
    value == null ||
    value === "unknown" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Values are scalars, flat objects, or complete arrays. */
export function fact(
  path: string,
  actual: unknown,
  anyOf: readonly unknown[],
): Fact {
  const correct = anyOf.some((expected) => same(actual, expected));
  const incomplete =
    missing(actual) ||
    anyOf.some((expected) => {
      if (
        !actual ||
        !expected ||
        typeof actual !== "object" ||
        typeof expected !== "object" ||
        Array.isArray(actual) ||
        Array.isArray(expected)
      ) {
        return false;
      }
      const values = actual as Record<string, unknown>;
      const entries = Object.entries(expected);
      return (
        Object.keys(values).every((key) => key in expected) &&
        entries.some(([key]) => missing(values[key])) &&
        entries.every(
          ([key, value]) => missing(values[key]) || same(values[key], value),
        )
      );
    });
  let status: Fact["status"] = "wrong";
  if (incomplete) {
    status = "missing";
  }
  if (correct) {
    status = "correct";
  }
  return { path, status, note: path };
}

export function check(path: string, passed: boolean): Condition {
  return { path, passed, message: path };
}

export function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    return value.replace(
      /^[^:]+:\/\/([^/?#]*)/,
      (_, authority: string) =>
        `${url.protocol}//${authority.slice(0, authority.lastIndexOf("@") + 1)}${url.host}`,
    );
  } catch {
    return value;
  }
}

/** Each declared URL is an alternative. Extra or duplicate official links fail. */
export function linkFact(
  path: string,
  links:
    readonly { kind: string; official: boolean; url: string }[] | undefined,
  kind: string,
  anyOf: readonly string[],
) {
  const actual =
    links
      ?.filter((link) => link.kind === kind && link.official)
      .map((link) => normalizeUrl(link.url))
      .sort() ?? [];
  return fact(
    path,
    actual,
    anyOf.map((url) => [normalizeUrl(url)]),
  );
}

export function evaluate(input: {
  required: Fact[];
  additional: Fact[];
  correctness?: Fact[];
  conditions: Condition[];
}) {
  const count = (facts: Fact[]) => {
    const correct = facts.filter((item) => item.status === "correct").length;
    return {
      correct,
      expected: facts.length,
      score: facts.length ? correct / facts.length : null,
    };
  };
  const required = count(input.required),
    additional = count(input.additional);
  const checks = (["required", "additional"] as const).flatMap((category) =>
    input[category].map((item) => ({ ...item, category })),
  );
  const allChecks = [
    ...checks,
    ...(input.correctness ?? []).map((item) => ({
      ...item,
      category: "condition" as const,
    })),
  ];
  const errorCount = allChecks.filter((item) => item.status === "wrong").length;
  return {
    required,
    additional,
    checks: allChecks,
    conditions: input.conditions,
    errorCount,
    noCheckedErrors: errorCount ? (0 as const) : (1 as const),
    passed:
      required.correct === required.expected &&
      errorCount === 0 &&
      input.conditions.every((item) => item.passed),
  };
}
