import { expect, test, vi } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { publicEvent } from "@/catalog/read/public-catalog";
import {
  readResearchCatalog,
  readResearchEvent,
} from "@/catalog/read/research";
import { runCatalogResearch } from "./workflow";
import type { ResearchCandidate } from "./research/contracts";
import type { ReadSourceResult } from "./sources/contracts";
import type { ReadSourceOptions } from "./sources/read-source";
import { ResearchLimitError } from "./runtime/budget";

const url = "https://example.org/example-fest";
const source: ReadSourceResult = {
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-03T12:00:00Z",
  method: "http",
  outcome: "ok",
  completeness: "full",
  links: [],
  markdown: "Example Fest 2027, July 1–3, Lisbon, Portugal.",
};
const candidate = (termIds: string[]): ResearchCandidate => ({
  eventName: "Example Fest",
  summary: "An outdoor music festival in Portugal.",
  editions: [{ key: "2027", year: 2027, status: "announced" }],
  claims: [
    { editionKey: "2027", field: "startsOn", value: "2027-07-01" },
    { editionKey: "2027", field: "endsOn", value: "2027-07-03" },
    { editionKey: "2027", field: "dateState", value: "confirmed" },
    { editionKey: "2027", field: "countryCode", value: "PT" },
    { editionKey: "2027", field: "locality", value: "Lisbon" },
    { editionKey: "2027", field: "termIds", value: termIds },
  ],
  prices: [],
  links: [{ owner: "event", kind: "official_site", url }],
  observations: [],
});
const input = {
  mode: "add" as const,
  name: "Example Fest",
  actor: "catalog-research",
  initiatedBy: "fixture-owner",
};
function fixture() {
  const client = testDatabase().client;
  const termIds = testFixtures(client)
    .festivalTerms()
    .map((term) => term.id);
  const readSource = vi.fn(async (_url: string, options: ReadSourceOptions) => {
    options.budget.consumePage(options.depth ?? 0);
    return source;
  });
  return { client, termIds, readSource };
}

test("concurrent and repeated failed reads are cached and charged once", async () => {
  const { client, termIds, readSource } = fixture();
  readSource.mockImplementation(async (_url, options) => {
    options.budget.consumePage(options.depth ?? 0);
    return { ...source, outcome: "failed", reason: "http_503" };
  });
  const result = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async (_prompt, context) => {
      const reads = await Promise.all([
        context.readSource(url),
        context.readSource(url),
      ]);
      expect(reads[0]).toBe(reads[1]);
      expect(await context.readSource(url)).toBe(reads[0]);
      return candidate(termIds);
    },
  });
  expect(readSource).toHaveBeenCalledTimes(1);
  expect(result.usage).toMatchObject({ pages: 1, modelCalls: 1 });
  expect(result.sources).toEqual([
    {
      attemptedUrl: url,
      finalUrl: url,
      retrievedAt: source.retrievedAt,
      outcome: "failed",
      reason: "http_503",
    },
  ]);
});

test("discovery shares the run budget and reserves the final model call", async () => {
  const { client, termIds } = fixture();
  const discoverSources = vi.fn(async (query, { budget }) => {
    budget.consumeSearch();
    budget.consumeModelCall();
    return {
      query,
      candidates: [],
      retrievedAt: source.retrievedAt,
      inputTokens: 7,
      outputTokens: 9,
      modelCostUsd: 0.1,
      searchCostUsd: 0.2,
    };
  });
  const result = await runCatalogResearch(
    { ...input, limits: { modelCalls: 3 } },
    {
      client,
      discoverSources,
      generateCandidate: async (_prompt, context) => {
        await context.discoverSources("Example Fest");
        expect(context.budget.remaining().modelCalls).toBe(1);
        expect(
          await context.discoverSources("Example Fest tickets"),
        ).toMatchObject({
          candidates: [],
          inputTokens: 0,
          outputTokens: 0,
          searchCostUsd: 0,
        });
        return candidate(termIds);
      },
    },
  );
  expect(discoverSources).toHaveBeenCalledTimes(1);
  expect(result.usage).toMatchObject({
    searches: 1,
    modelCalls: 2,
    inputTokens: 7,
    outputTokens: 9,
    cachedInputTokens: null,
    reasoningTokens: null,
    modelCostUsd: null,
    searchCostUsd: 0.2,
  });
});

test.each([
  [
    new Error("private payload", { cause: new ResearchLimitError("pages") }),
    "skipped",
    "limit_reached",
    "pages",
    "Error>ResearchLimitError",
  ],
  [
    Object.assign(new Error("private payload"), {
      statusCode: 429,
      code: "RateLimited",
    }),
    "failed",
    "model_failed",
    "model_failed",
    "Error http_429 RateLimited",
  ],
] as const)(
  "research failures retain safe diagnostics: %s",
  async (error, outcome, code, detail, diagnostic) => {
    const { client } = fixture();
    const result = await runCatalogResearch(input, {
      client,
      generateCandidate: async () => {
        throw error;
      },
    });
    expect(result.outcome).toBe(outcome);
    expect(result.gaps).toEqual([{ code, detail, diagnostic }]);
    expect(result.usage).toMatchObject({
      modelCalls: 1,
      cachedInputTokens: null,
      reasoningTokens: null,
    });
    expect(result.operations).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("private payload");
  },
);

test.each([
  [{ modelCalls: 0 }, "modelCalls", 0],
  [{ modelInputChars: 1 }, "modelInputChars", 0],
  [{ durationMs: 0 }, "time", 0],
] as const)(
  "exhausted budget prevents generation: %s",
  async (limits, detail, modelCalls) => {
    const { client } = fixture();
    const generateCandidate = vi.fn(async () => candidate([]));
    const result = await runCatalogResearch(
      { ...input, limits },
      { client, generateCandidate },
    );
    expect(generateCandidate).not.toHaveBeenCalled();
    expect(result.outcome).toBe("skipped");
    expect(result.gaps).toContainEqual(
      expect.objectContaining({ code: "limit_reached", detail }),
    );
    expect(result.usage.modelCalls).toBe(modelCalls);
  },
);

test("one model answer writes directly; dry run rolls back without a database copy", async () => {
  const { client, termIds, readSource } = fixture();
  const generateCandidate = vi.fn(async () => candidate(termIds));
  const before = readResearchCatalog(client);
  const serialize = vi.spyOn(client, "serialize");
  const preview = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async (prompt, context) => {
      expect(JSON.parse(prompt).inspectedSources).toEqual([]);
      await context.readSource(url);
      return generateCandidate();
    },
  });
  expect(preview.outcome).toBe("published");
  expect(preview.changes).toContainEqual(
    expect.objectContaining({ field: "starts_on", newValue: "2027-07-01" }),
  );
  expect(readResearchCatalog(client)).toEqual(before);
  expect(serialize).not.toHaveBeenCalled();
  const applied = await runCatalogResearch(
    { ...input, dryRun: false },
    {
      client,
      readSource,
      generateCandidate,
    },
  );
  expect(applied.outcome).toBe("published");
  expect(generateCandidate).toHaveBeenCalledTimes(2);
  expect(applied.gaps).toEqual([]);
  expect(readResearchCatalog(client).map((event) => event.id)).toEqual([
    applied.eventId,
  ]);
  const saved = readResearchEvent(client, applied.eventId!)!;
  expect(saved.editions).toHaveLength(1);
  expect(saved.changes.length).toBeGreaterThan(0);
  expect(saved.editions[0].changes.length).toBeGreaterThan(0);
  for (const change of [...saved.changes, ...saved.editions[0].changes]) {
    expect(change).toMatchObject({
      actor: "catalog-research",
      initiatedBy: "fixture-owner",
    });
  }
  expect(publicEvent(client, applied.eventId!)?.editions[0]).toMatchObject({
    startsOn: "2027-07-01",
    endsOn: "2027-07-03",
    locality: "Lisbon",
  });
});

test("rerun preserves identity and omitting facts does not clear them", async () => {
  const { client, termIds, readSource } = fixture();
  const first = await runCatalogResearch(
    { ...input, dryRun: false },
    {
      client,
      readSource,
      generateCandidate: async () => candidate(termIds),
    },
  );
  const before = readResearchCatalog(client);
  const editionId = readResearchEvent(client, first.eventId!)!.editions[0].id;
  const proposed = candidate(termIds);
  proposed.eventId = first.eventId;
  proposed.claims = [
    { editionKey: "2027", field: "ticketAvailability", value: "sold_out" },
  ];
  const preview = await runCatalogResearch(
    {
      mode: "refresh",
      eventId: first.eventId,
      actor: input.actor,
      initiatedBy: input.initiatedBy,
    },
    { client, readSource, generateCandidate: async () => proposed },
  );
  expect(preview.outcome).toBe("updated");
  expect(preview.changes).toEqual([
    expect.objectContaining({
      subject: editionId,
      field: "ticket_availability",
      oldValue: "unknown",
      newValue: "sold_out",
    }),
  ]);
  // Private reads include stored versions and audit history, not only public facts.
  expect(readResearchCatalog(client)).toEqual(before);
  const changed = await runCatalogResearch(
    {
      mode: "refresh",
      eventId: first.eventId,
      actor: input.actor,
      initiatedBy: input.initiatedBy,
      dryRun: false,
    },
    { client, readSource, generateCandidate: async () => proposed },
  );
  expect(changed.outcome).toBe("updated");
  expect(changed.eventId).toBe(first.eventId);
  expect(changed.changes).toEqual(preview.changes);
  expect(publicEvent(client, first.eventId!)?.editions[0]).toMatchObject({
    id: editionId,
    startsOn: "2027-07-01",
    ticketAvailability: "sold_out",
  });
  const after = readResearchCatalog(client);
  expect(after.map((event) => event.id)).toEqual([first.eventId]);
  expect(after[0].editions.map((edition) => edition.id)).toEqual([editionId]);
  const repeat = await runCatalogResearch(
    {
      mode: "check",
      eventId: first.eventId,
      actor: input.actor,
      initiatedBy: input.initiatedBy,
      dryRun: false,
    },
    { client, readSource, generateCandidate: async () => proposed },
  );
  expect(repeat.outcome).toBe("unchanged");
  expect(repeat.eventId).toBe(first.eventId);
  expect(repeat.changes).toEqual([]);
  expect(readResearchCatalog(client)).toEqual(after);
});

test.each(["add", "refresh"] as const)(
  "invalid %s leaves catalog facts and history unchanged",
  async (mode) => {
    const { client, termIds, readSource } = fixture();
    const first = await runCatalogResearch(
      { ...input, dryRun: false },
      { client, readSource, generateCandidate: async () => candidate(termIds) },
    );
    expect(first.outcome).toBe("published");
    const before = readResearchCatalog(client);
    const proposed = candidate(termIds);
    if (mode === "add") proposed.eventName = "Another Fest";
    else {
      proposed.eventId = first.eventId;
      // The summary write succeeds before the invalid edition forces a rollback.
      proposed.summary = "A proposed replacement description.";
    }
    proposed.claims.push({
      editionKey: "2027",
      field: "endsOn",
      value: "2027-06-01",
    });
    const result = await runCatalogResearch(
      {
        ...input,
        mode,
        eventId: mode === "refresh" ? first.eventId : undefined,
        dryRun: false,
      },
      {
        client,
        readSource,
        generateCandidate: async () => proposed,
      },
    );
    expect(result.outcome).toBe("failed");
    expect(result.gaps).toContainEqual(
      expect.objectContaining({ code: "write_failed" }),
    );
    expect(result.modelResponse).toEqual({ text: null, object: proposed });
    expect(result.changes).toEqual([]);
    expect(readResearchCatalog(client)).toEqual(before);
  },
);

test("refresh exposes only its Event and saved links to the model", async () => {
  const { client, readSource } = fixture();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.event({ canonicalName: "Unrelated Fest" });
  fx.eventLink(event, { url, kind: "official_site", official: true });
  const generateCandidate = vi.fn(async (prompt: string) => {
    const context = JSON.parse(prompt);
    expect(context.catalog.map((item: { id: string }) => item.id)).toEqual([
      event.id,
    ]);
    expect(context.knownLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url, owner: "event" }),
      ]),
    );
    expect(context.inspectedSources).toHaveLength(1);
    return { ...candidate([]), eventId: "wrong-event" };
  });
  const result = await runCatalogResearch(
    {
      mode: "refresh",
      eventId: event.id,
      actor: input.actor,
      initiatedBy: input.initiatedBy,
      dryRun: false,
    },
    { client, readSource, generateCandidate },
  );
  expect(readSource).toHaveBeenCalledTimes(1);
  expect(generateCandidate).toHaveBeenCalledTimes(1);
  expect(result.outcome).toBe("skipped");
  expect(result.operations).toEqual([]);
});

test("reports preserve raw candidates even when local schema validation rejects them", async () => {
  const { client, readSource } = fixture();
  const raw = { eventName: "Bad proposal", summary: null, claims: "invalid" };
  const output = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async () => raw,
  });
  expect(output.gaps.some((gap) => gap.code === "invalid_candidate")).toBe(
    true,
  );
  expect(output.modelResponse).toEqual({ text: null, object: raw });
  expect(
    JSON.parse(JSON.stringify(output)).modelResponse.object.summary,
  ).toBeNull();
  expect(output.operations).toEqual([]);
});

test("reports use null modelResponse when generation fails before returning output", async () => {
  const { client, readSource } = fixture();
  const output = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async () => {
      throw new Error("provider failed");
    },
  });
  expect(output.modelResponse).toBeNull();
});
