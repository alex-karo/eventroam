import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createResearchBudget } from "../runtime/budget";
import { ToolOutputCapture } from "../tool-output-capture";
import { createResearchTools } from "./index";
import { createSourceSession } from "./session";
import type { ReadPageResult } from "./read-page/contracts";

const url = "https://example.org/festival";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test("captures final tool returns in invocation order, including cached pages", async () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-tools-"));
  roots.push(root);
  const capture = new ToolOutputCapture("run-1", root);
  let now = 0;
  const budget = createResearchBudget({}, () => now);
  const config = { apiKey: "fixture", model: "fixture", limits: budget.limits };
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const page: ReadPageResult = {
    attemptedUrl: url,
    finalUrl: url,
    retrievedAt: "2026-10-08T00:00:00.000Z",
    method: "http",
    status: "ok",
    reasonCode: "javascript_required",
    markdown: "A".repeat(81_000) + "CACHE_TAIL",

    httpStatus: 200,
  };
  const readPage = vi.fn(
    async (_url: string, options: { budget: typeof budget }) => {
      await hold;
      options.budget.consumePage();
      return { ...page, rawProviderSecret: "NEVER_SAVE" };
    },
  );
  const sources = createSourceSession(budget, config, [], {
    readPage,
    searchWeb: async (query, options) => {
      options.budget.consumeSearch();
      return {
        query,
        candidates: [],
        retrievedAt: page.retrievedAt,
      };
    },
  });
  const tools = createResearchTools(
    sources,
    budget,
    () => ({ stage: "research", step: 1, attempt: 1 }),
    undefined,
    undefined,
    capture,
  );
  const pendingPage = tools.readPage.execute!({ url }, {} as never);
  const search = await tools.searchWeb.execute!(
    { query: "Example Fest" },
    {} as never,
  );
  release();
  const first = await pendingPage;
  now = 1_000;
  const cached = await tools.readPage.execute!({ url }, {} as never);
  expect(readPage).toHaveBeenCalledOnce();
  expect(sources.reads[0].markdown).toBe(page.markdown);
  expect(sources.reads[0].reasonCode).toBe("javascript_required");
  expect(first).toMatchObject({
    url,
    status: "ok",
    reasonCode: "javascript_required",
    truncated: true,
    remaining: { durationMs: 600_000 },
  });
  expect(cached).toMatchObject({ remaining: { durationMs: 599_000 } });
  const files = readdirSync(join(root, "run-1"));
  expect(files.filter((file) => file.endsWith(".json"))).toEqual([
    "00001-readPage.json",
    "00002-searchWeb.json",
    "00003-readPage.json",
  ]);
  const saved = files
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(root, "run-1", file), "utf8")));
  expect(saved.map((item) => item.result)).toEqual([first, search, cached]);
  expect(saved[0].result.markdown).toHaveLength(79_700);
  expect(saved[0].result.remaining.searches).toBe(2);
  expect(saved[2].result).toEqual(cached);
  expect(readFileSync(join(root, "run-1", "00001-readPage.md"), "utf8")).toBe(
    (first as { markdown: string }).markdown,
  );
  expect(JSON.stringify(saved)).not.toContain("CACHE_TAIL");
  expect(JSON.stringify(saved)).not.toContain("NEVER_SAVE");
  expect(JSON.stringify(saved)).not.toContain("httpStatus");
});
