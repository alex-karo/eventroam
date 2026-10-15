import { expect, test } from "vitest";
import { scoreToolUse, type EvalToolCall } from "./tool-use";

const url = "https://festival.example/official";
const read: EvalToolCall = { tool: "readPage", url };
const search: EvalToolCall = { tool: "searchWeb", query: "Festival official" };

test("absent facts and recovered known sources must not cause search", () => {
  expect(scoreToolUse({ maxSearches: 0 }, [read])?.score).toBe(1);
  expect(scoreToolUse({ maxSearches: 0 }, [read, search])?.score).toBe(0);
});

test("required recovery must search and inspect the prior candidate before repeating", () => {
  const expected = {
    minSearches: 1,
    readBeforeSearch: [{ url, searchIndex: 2 }],
  };
  expect(scoreToolUse(expected, [search, read])?.score).toBe(1);
  expect(scoreToolUse(expected, [search, read, search])?.score).toBe(1);
  expect(scoreToolUse(expected, [search, search, read])?.score).toBe(0.5);
  expect(scoreToolUse(expected, [search])?.score).toBe(0.5);
  expect(scoreToolUse(expected, [read])?.score).toBe(0.5);
});

test("known links must precede the first search even when the count is acceptable", () => {
  const expected = {
    minSearches: 1,
    maxSearches: 1,
    readBeforeSearch: [{ url, searchIndex: 1 }],
  };
  expect(scoreToolUse(expected, [read, search])?.score).toBe(1);
  expect(scoreToolUse(expected, [search, read])?.score).toBeLessThan(1);
  expect(scoreToolUse(expected, [read, search, search])?.score).toBeLessThan(1);
});
