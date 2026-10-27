import { expect, test } from "vitest";
import { check, evaluate, fact, linkFact } from "./facts";

test.each([
  ["value", "DK", ["DK"], "correct"],
  ["alternative", "second", ["first", "second"], "correct"],
  ["missing", null, ["DK"], "missing"],
  ["unknown", "unknown", ["DK"], "missing"],
  ["wrong", "DE", ["DK"], "wrong"],
  ["zero", 0, [0], "correct"],
  ["false", false, [false], "correct"],
  [
    "complete object",
    { start: "a", end: "b" },
    [{ start: "a", end: "b" }],
    "correct",
  ],
  [
    "partial object",
    { start: "a", end: null },
    [{ start: "a", end: "b" }],
    "missing",
  ],
  [
    "wrong partial object",
    { start: "x", end: null },
    [{ start: "a", end: "b" }],
    "wrong",
  ],
  [
    "partial alternative",
    { start: "c", end: null },
    [
      { start: "a", end: "b" },
      { start: "c", end: "d" },
    ],
    "missing",
  ],
  [
    "extra property",
    { start: "a", extra: 1 },
    [{ start: "a", end: "b" }],
    "wrong",
  ],
  ["missing array", [], [["a"]], "missing"],
  ["wrong array", ["a", "x"], [["a"]], "wrong"],
] as const)("fact: %s", (_, actual, anyOf, status) => {
  expect(fact("field", actual, anyOf).status).toBe(status);
});

test("URLs keep declared alternatives and significant paths, queries and fragments", () => {
  const link = {
    kind: "official_site",
    official: true,
    url: "https://EXAMPLE.com:443/Path?a=1#x",
  };
  const score = (
    urls: string[],
    allowed = ["https://example.com/Path?a=1#x"],
  ) =>
    linkFact(
      "website",
      urls.map((url) => ({ ...link, url })),
      link.kind,
      allowed,
    ).status;
  expect(score([link.url])).toBe("correct");
  expect(
    score(
      ["https://example.com/en/"],
      ["https://example.com/", "https://example.com/en/"],
    ),
  ).toBe("correct");
  for (const url of [
    "https://example.com/path?a=1#x",
    "https://example.com/Path?a=2#x",
    "https://example.com/Path?a=1#y",
    "bad URL",
  ]) {
    expect(score([url])).toBe("wrong");
  }
  expect(score(["https://example.com"], ["https://example.com/"])).toBe(
    "wrong",
  );
  expect(score([link.url, link.url])).toBe("wrong");
  expect(score([link.url, "https://other.example/"])).toBe("wrong");
  expect(
    linkFact("website", [{ ...link, official: false }], link.kind, [link.url])
      .status,
  ).toBe("missing");
});

test("counts, omissions, errors, conditions and N/A stay separate", () => {
  const run = (
    additional = [fact("optional", null, ["value"])],
    conditions = [check("execution", true)],
  ) =>
    evaluate({
      required: [fact("country", "DK", ["DK"])],
      additional,
      conditions,
    });
  expect(run()).toMatchObject({
    passed: true,
    errorCount: 0,
    required: { correct: 1, expected: 1, score: 1 },
    additional: { correct: 0, expected: 1, score: 0 },
  });
  expect(run([fact("optional", "wrong", ["value"])])).toMatchObject({
    passed: false,
    errorCount: 1,
    noCheckedErrors: 0,
  });
  expect(run([], [check("execution", false)])).toMatchObject({
    passed: false,
    errorCount: 0,
    additional: { expected: 0, score: null },
  });
  expect(
    evaluate({ required: [], additional: [], conditions: [] }),
  ).toMatchObject({ required: { score: null }, additional: { score: null } });
});

test("correctness checks count errors without adding completeness units", () => {
  expect(
    evaluate({
      required: [],
      additional: [],
      conditions: [],
      correctness: [fact("offer", false, [true])],
    }),
  ).toMatchObject({
    errorCount: 1,
    noCheckedErrors: 0,
    passed: false,
    required: { expected: 0, score: null },
    additional: { expected: 0, score: null },
    checks: [{ path: "offer", category: "condition", status: "wrong" }],
  });
});
