import { expect, it } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { fixedReader } from "./fixed-reader";
import { loadEvalSuite } from "./fixtures";

it("replays a fixed Reader range and segment with stable evidence IDs", async () => {
  const item = loadEvalSuite().cases.find(
    ({ id }) => id === "editor-recovered-website",
  );
  if (!item || item.location || !item.roleHandoff) {
    throw new Error("Expected the Editor website recovery fixture");
  }
  const [recorded] = item.roleHandoff.pages;
  const source = item.sources.find(
    ({ attemptedUrl }) => attemptedUrl === recorded.url,
  )!;
  const [heading, details] = source.markdown.split("\n");
  const quote = `${heading}\n${details}`;
  const budget = createResearchBudget();
  const read = fixedReader(item)!;
  const execution = await read({
    budget,
    config: { apiKey: "fixture", model: "fixture", limits: budget.limits },
    input: {
      assignment: {},
      source: { id: recorded.sourceId, finalUrl: source.finalUrl },
      page: source.markdown,
    },
  });
  expect(execution.status).toBe("success");
  expect(execution.bound?.evidence).toMatchObject([
    { id: "s1-e1", quote, span: { start: 0, end: quote.length } },
    {
      id: "s1-e2",
      quote: details,
      span: { start: heading.length + 1, end: quote.length },
    },
  ]);
});
