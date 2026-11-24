import { testDatabase } from "@/test/database";
import { modelReply, type ProviderRequest } from "@/test/ingestion-provider";
import { afterEach, expect, it, vi } from "vitest";
import { createCollection } from "../../evidence/collection";
import { createResearchBudget } from "../../runtime/budget";
import { createSourceSession } from "../../tools/session";
import type { SearchWebOptions } from "../../tools/search-web/search";
import { collectResearch } from "./agent";

afterEach(() => vi.unstubAllGlobals());

it("sends one search per model step and allows a later search", async () => {
  const query = "Example Festival official programme";
  const laterQuery = "Example Festival organizer announcements";
  const reply = { checks: [], unresolved: [] };
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(
      modelReply(
        null,
        { id: "first", name: "searchWeb", args: { query } },
        {
          id: "extra",
          name: "searchWeb",
          args: { query: "Example Festival official site" },
        },
      ),
    )
    .mockResolvedValueOnce(
      modelReply(null, {
        id: "later",
        name: "searchWeb",
        args: { query: laterQuery },
      }),
    )
    .mockResolvedValueOnce(modelReply(JSON.stringify(reply)));
  vi.stubGlobal("fetch", fetch);

  const budget = createResearchBudget();
  const config = {
    apiKey: "fixture",
    model: "fixture/model",
    limits: budget.limits,
  };
  const searchWeb = vi.fn(async (query: string, options: SearchWebOptions) => {
    options.budget.consumeSearch();
    return { query, candidates: [], retrievedAt: "2026-10-15T12:00:00Z" };
  });
  const sourceSession = createSourceSession(budget, config, [], { searchWeb });
  const collection = createCollection({
    runId: "search-step-test",
    startedAt: Date.now(),
    sources: sourceSession,
    budget,
    config,
    deps: {},
    assignment: {},
  });
  const result = await collectResearch({
    input: { mode: "add", input: "Example Festival", actor: "test" },
    context: {
      catalog: [],
      terms: [],
      knownLinks: [],
      currentDate: "2026-10-15",
    },
    budget,
    config,
    deps: { client: testDatabase().client },
    signal: collection.signal,
    collection,
    sourceSession,
  });

  expect(result).toMatchObject({ status: "success", output: reply });
  expect(searchWeb.mock.calls.map(([query]) => query)).toEqual([
    query,
    laterQuery,
  ]);
  expect(budget.snapshot().searches).toBe(2);
  const nextRequest: ProviderRequest = JSON.parse(
    String(fetch.mock.calls[1][1]?.body),
  );
  const extraResult = nextRequest.messages.find(
    (message) => message.role === "tool" && message.tool_call_id === "extra",
  );
  expect(JSON.stringify(extraResult?.content)).toContain(
    "already_searched_this_step",
  );
});
