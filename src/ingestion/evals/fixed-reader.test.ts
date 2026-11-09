import { expect, it } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { fixedReader } from "./fixed-reader";
import { loadEvalSuite } from "./fixtures";

it("replays an Editor quotation with its original offsets and evidence ID", async () => {
  const item = loadEvalSuite().cases.find(
    ({ id }) => id === "editor-day-ticket",
  );
  if (!item || item.location || !item.roleHandoff) {
    throw new Error("Expected the Editor day ticket fixture");
  }
  const [recorded] = item.roleHandoff.pages;
  const source = item.sources.find(
    ({ attemptedUrl }) => attemptedUrl === recorded.url,
  )!;
  const { quote } = recorded.reader!.evidence[0];
  const start = source.markdown.indexOf(quote);
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
  expect(execution.bound?.evidence[0]).toMatchObject({
    id: "s1-e1",
    quote,
    span: { start, end: start + quote.length },
  });
});
