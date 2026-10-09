import { expect, test, vi } from "vitest";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type Database from "better-sqlite3";
import { catalogChanges, operationReceipts } from "@/db/schema";
import {
  readResearchCatalog,
  readResearchEvent,
} from "@/catalog/read/research";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { runCatalogResearch } from "./workflow";
import type { ResearchCandidate } from "./research/contracts";
import { ResearchLimitError } from "./runtime/budget";
import type { ReadSourceResult } from "./sources/contracts";

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
const reason = "The official page states this for the 2027 festival.";
const input = {
  mode: "add" as const,
  name: "Example Fest",
  actor: "catalog-research",
  initiatedBy: "fixture-owner",
};
function candidate(termIds: string[]): ResearchCandidate {
  return {
    status: "success",
    data: {
      eventName: "Example Fest",
      reason: "The official page identifies a distinct festival.",
      sources: [
        { url, information: "Official 2027 dates and Lisbon location." },
      ],
      summary: { value: "An outdoor music festival in Portugal.", reason },
      links: { website: url, socials: {} },
      editions: [
        {
          key: "2027",
          year: { value: 2027, reason },
          dates: {
            value: {
              startsOn: "2027-07-01",
              endsOn: "2027-07-03",
              state: "confirmed",
            },
            reason,
          },
          locality: { value: "Lisbon", reason },
          countryCode: { value: "PT", reason },
          classification: { add: { value: termIds, reason } },
          links: {},
        },
      ],
    },
    errors: [],
    unresolved: [],
  };
}
function fixture() {
  const client = testDatabase().client;
  const termIds = testFixtures(client)
    .festivalTerms()
    .map((term) => term.id);
  const readSource = vi.fn(
    async (
      _url: string,
      options: {
        budget: { consumePage: (depth?: number) => void };
        depth?: number;
      },
    ) => {
      options.budget.consumePage(options.depth);
      return source;
    },
  );
  return { client, termIds, readSource };
}
function catalogState(client: Database.Database) {
  const db = drizzle(client);
  return {
    catalog: readResearchCatalog(client),
    audit: db
      .select()
      .from(catalogChanges)
      .orderBy(asc(catalogChanges.id))
      .all(),
    receipts: db
      .select()
      .from(operationReceipts)
      .orderBy(asc(operationReceipts.operationKey))
      .all(),
  };
}

test("concurrent and repeated failed source reads are cached and charged once", async () => {
  const { client, readSource } = fixture();
  readSource.mockImplementation(async (_url, options) => {
    options.budget.consumePage(options.depth);
    return {
      ...source,
      outcome: "failed",
      reason: "http_503",
      markdown: "",
      completeness: "none",
    };
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
      return candidate([]);
    },
  });
  expect(readSource).toHaveBeenCalledTimes(1);
  expect(result.usage).toMatchObject({ pages: 1, modelCalls: 1 });
  expect(result.sources).toEqual([
    expect.objectContaining({ outcome: "failed", reason: "http_503" }),
  ]);
});

test("discovery shares the run budget and reserves the final model call", async () => {
  const { client } = fixture();
  const discoverSources = vi.fn(
    async (
      query: string,
      options: {
        budget: { consumeSearch: () => void; consumeModelCall: () => void };
      },
    ) => {
      options.budget.consumeSearch();
      options.budget.consumeModelCall();
      return {
        query,
        candidates: [],
        retrievedAt: source.retrievedAt,
        inputTokens: 7,
        outputTokens: 9,
        modelCostUsd: 0.1,
        searchCostUsd: 0.2,
      };
    },
  );
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
        return candidate([]);
      },
    },
  );
  expect(discoverSources).toHaveBeenCalledTimes(1);
  expect(result.usage).toMatchObject({
    searches: 1,
    modelCalls: 2,
    inputTokens: 7,
    outputTokens: 9,
    modelCostUsd: null,
    searchCostUsd: 0.2,
  });
});

test("create dry run explains actual changes and rolls back catalog and audit", async () => {
  const { client, termIds, readSource } = fixture();
  const before = catalogState(client);
  const preview = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async (_prompt, context) => {
      await context.readSource(url);
      return candidate(termIds);
    },
  });
  expect(preview).toMatchObject({
    researchStatus: "success",
    outcome: "published",
    errors: [],
    unresolved: [],
  });
  expect(preview.sourceSummaries).toEqual([
    { url, information: "Official 2027 dates and Lisbon location." },
  ]);
  expect(preview.sources).toEqual([
    expect.objectContaining({ finalUrl: url, outcome: "ok" }),
  ]);
  expect(preview.changes).toContainEqual(
    expect.objectContaining({
      field: "canonical_name",
      explanations: ["The official page identifies a distinct festival."],
    }),
  );
  for (const field of [
    "starts_on",
    "ends_on",
    "date_state",
    "occurrence_year",
    "locality",
    "country_code",
    "terms",
  ]) {
    expect(preview.changes).toContainEqual(
      expect.objectContaining({ field, explanations: [reason] }),
    );
  }
  expect(catalogState(client)).toEqual(before);
  const applied = await runCatalogResearch(
    { ...input, dryRun: false },
    {
      client,
      readSource,
      generateCandidate: async () => candidate(termIds),
    },
  );
  expect(applied.outcome).toBe("published");
  expect(readResearchEvent(client, applied.eventId!)?.editions).toHaveLength(1);
  expect(
    applied.changes.find((change) => change.field === "starts_on")?.newValue,
  ).toBe("2027-07-01");
});

test("partial no-op keeps questions and source summaries without audit changes", async () => {
  const { client, readSource } = fixture();
  const event = testFixtures(client).event({ canonicalName: "Example Fest" });
  const before = catalogState(client);
  const proposal = candidate([]);
  proposal.status = "partial";
  proposal.data = {
    eventId: event.id,
    eventName: "Example Fest",
    sources: [
      { url, information: "Page names the festival but omits ticket prices." },
    ],
    links: { socials: {} },
    editions: [],
  };
  proposal.unresolved = [
    { message: "Ticket prices could not be confirmed.", field: "tickets" },
  ];
  const result = await runCatalogResearch(
    { mode: "check", eventId: event.id, actor: input.actor },
    {
      client,
      readSource,
      generateCandidate: async () => proposal,
    },
  );
  expect(result).toMatchObject({
    researchStatus: "partial",
    outcome: "unchanged",
    changes: [],
    unresolved: proposal.unresolved,
  });
  expect(result.sourceSummaries).toEqual(proposal.data.sources);
  expect(catalogState(client)).toEqual(before);
});

test("recovered source failure retains staged error beside successful research", async () => {
  const { client, readSource } = fixture();
  readSource.mockImplementation(async (_url, options) => {
    options.budget.consumePage(options.depth);
    return {
      ...source,
      outcome: "failed",
      reason: "http_503",
      markdown: "",
      completeness: "none",
    };
  });
  const proposal = candidate([]);
  proposal.errors = [
    {
      code: "source_unavailable",
      message: "The first page returned a temporary error.",
      url,
    },
  ];
  proposal.data!.sources = [];
  const result = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async (_prompt, context) => {
      await context.readSource(url);
      return proposal;
    },
  });
  expect(result.researchStatus).toBe("success");
  expect(result.errors).toContainEqual({
    code: "source_unavailable",
    message: "The first page returned a temporary error.",
    url,
    stage: "source",
  });
  expect(result.sources).toEqual([
    expect.objectContaining({ outcome: "failed", reason: "http_503" }),
  ]);
  expect(result.sourceSummaries).toEqual([]);
});

test("duplicate add skips every proposed write while retaining research and name mismatch", async () => {
  const { client, termIds, readSource } = fixture();
  const event = testFixtures(client).event({ canonicalName: "Example Fest" });
  const before = catalogState(client);
  const proposal = candidate(termIds);
  proposal.data!.eventId = event.id;
  proposal.data!.eventName = " Example Fest Revised ";
  const result = await runCatalogResearch(input, {
    client,
    readSource,
    generateCandidate: async () => proposal,
  });
  expect(result).toMatchObject({
    researchStatus: "success",
    outcome: "skipped",
    eventId: event.id,
    operations: [],
    changes: [],
  });
  expect(result.eventNameMismatch).toEqual({
    eventId: event.id,
    storedName: "Example Fest",
    observedName: " Example Fest Revised ",
  });
  expect(catalogState(client)).toEqual(before);
});

test("refresh preserves identity, reports mismatch, and emits no duplicate audit on no-op", async () => {
  const { client, readSource } = fixture();
  const event = testFixtures(client).event({ canonicalName: "Example Fest" });
  const proposal = candidate([]);
  proposal.data = {
    eventId: event.id,
    eventName: "Another Name",
    sources: [],
    links: { socials: {} },
    editions: [],
    summary: { value: "A changed summary.", reason },
  };
  const first = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: input.actor, dryRun: false },
    {
      client,
      readSource,
      generateCandidate: async () => proposal,
    },
  );
  expect(first.outcome).toBe("updated");
  expect(first.changes).toEqual([
    expect.objectContaining({ field: "summary", explanations: [reason] }),
  ]);
  expect(first.eventNameMismatch).toEqual({
    eventId: event.id,
    storedName: "Example Fest",
    observedName: "Another Name",
  });
  const before = catalogState(client);
  const repeat = await runCatalogResearch(
    { mode: "check", eventId: event.id, actor: input.actor, dryRun: false },
    {
      client,
      readSource,
      generateCandidate: async () => proposal,
    },
  );
  expect(repeat).toMatchObject({
    outcome: "unchanged",
    researchStatus: "success",
    changes: [],
  });
  expect(repeat.eventNameMismatch).toEqual(first.eventNameMismatch);
  expect(catalogState(client).audit).toEqual(before.audit);
  expect(readResearchEvent(client, event.id)?.canonicalName).toBe(
    "Example Fest",
  );
});

test("cancellation and grouped clearing explain only changed writer fields", async () => {
  const { client, readSource } = fixture();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.occurrence(event, {
    occurrenceKey: "2027",
    latitude: 38.72,
    longitude: -9.14,
    coordinatePrecision: "approximate",
  });
  const proposal = candidate([]);
  proposal.data = {
    eventId: event.id,
    eventName: "Example Fest",
    sources: [],
    links: { socials: {} },
    editions: [
      {
        key: "2027",
        dates: { value: null, reason: "The announced dates were withdrawn." },
        scheduleStatus: {
          value: "cancelled",
          reason: "The official page explicitly cancels this edition.",
        },
        coordinates: {
          value: null,
          reason: "The announced location was withdrawn.",
        },
        links: {},
      },
    ],
  };
  const result = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: input.actor },
    {
      client,
      readSource,
      generateCandidate: async () => proposal,
    },
  );
  expect(result.outcome).toBe("updated");
  expect(result.changes).toContainEqual(
    expect.objectContaining({
      subject: edition.id,
      field: "schedule_status",
      newValue: "cancelled",
      explanations: ["The official page explicitly cancels this edition."],
    }),
  );
  for (const field of ["starts_on", "ends_on", "date_state"]) {
    expect(result.changes).toContainEqual(
      expect.objectContaining({
        subject: edition.id,
        field,
        explanations: ["The announced dates were withdrawn."],
      }),
    );
  }
  for (const field of ["latitude", "longitude", "coordinate_precision"]) {
    expect(result.changes).toContainEqual(
      expect.objectContaining({
        subject: edition.id,
        field,
        explanations: ["The announced location was withdrawn."],
      }),
    );
  }
  expect(
    result.changes.some((change) => change.field === "canonical_name"),
  ).toBe(false);
});

test("taxonomy add/remove reasons combine and ticket block reasons follow actual changes", async () => {
  const { client, readSource } = fixture();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const edition = fx.occurrence(event, { occurrenceKey: "2027" });
  const oldTerm = fx.term();
  const newTerm = fx.term();
  fx.assignTerm(edition, oldTerm);
  const proposal = candidate([]);
  proposal.data = {
    eventId: event.id,
    eventName: "Example Fest",
    sources: [],
    links: { socials: {} },
    editions: [
      {
        key: "2027",
        links: {},
        classification: {
          add: {
            value: [newTerm.id],
            reason: "The programme now includes this category.",
          },
          remove: {
            value: [oldTerm.id],
            reason: "The old category no longer applies.",
          },
        },
        tickets: {
          value: {
            variants: [
              {
                label: "Weekend",
                amount: 100.5,
                currency: "EUR",
                availability: "available",
              },
            ],
            basePrice: {
              kind: "exact",
              currency: "EUR",
              minAmount: 100.5,
              maxAmount: 100.5,
              coverage: "full_programme",
            },
          },
          reason: "The official ticket page lists a weekend pass.",
        },
      },
    ],
  };
  const result = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: input.actor },
    { client, readSource, generateCandidate: async () => proposal },
  );
  expect(result.outcome).toBe("updated");
  expect(result.changes).toContainEqual(
    expect.objectContaining({
      subject: edition.id,
      field: "terms",
      explanations: [
        "The programme now includes this category.",
        "The old category no longer applies.",
      ],
    }),
  );
  for (const field of [
    "price_kind",
    "price_currency",
    "price_min_minor",
    "price_max_minor",
    "price_coverage",
    "price_details",
  ]) {
    expect(result.changes).toContainEqual(
      expect.objectContaining({
        subject: edition.id,
        field,
        explanations: ["The official ticket page lists a weekend pass."],
      }),
    );
  }
});

test("writer failure preserves research status, raw output, summaries, and rollback", async () => {
  const { client, readSource } = fixture();
  testFixtures(client).event({
    canonicalName: "Example Fest",
    slug: "example-fest",
  });
  const before = catalogState(client);
  const proposal = candidate([]);
  const result = await runCatalogResearch(
    { ...input, dryRun: false },
    {
      client,
      readSource,
      generateCandidate: async () => proposal,
    },
  );
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "success",
    changes: [],
    sourceSummaries: proposal.data!.sources,
  });
  expect(result.errors).toContainEqual({
    code: "write_failed",
    stage: "write",
    message: "Catalog write failed",
  });
  expect(result.modelResponse).toEqual({ text: null, object: proposal });
  expect(catalogState(client)).toEqual(before);
});

test("name mismatch survives a rolled-back refresh write", async () => {
  const { client, readSource } = fixture();
  const event = testFixtures(client).event({ canonicalName: "Example Fest" });
  client.exec(
    "CREATE TRIGGER block_test_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'blocked by test'); END",
  );
  const proposal = candidate([]);
  proposal.data = {
    eventId: event.id,
    eventName: "Another Name",
    sources: [{ url, information: "Official name differs." }],
    links: { socials: {} },
    editions: [],
    summary: { value: "Changed summary", reason },
  };
  const result = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: input.actor, dryRun: false },
    { client, readSource, generateCandidate: async () => proposal },
  );
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "success",
    changes: [],
    sourceSummaries: proposal.data.sources,
  });
  expect(result.eventNameMismatch).toEqual({
    eventId: event.id,
    storedName: "Example Fest",
    observedName: "Another Name",
  });
  expect(result.errors).toContainEqual({
    code: "write_failed",
    stage: "write",
    message: "Catalog write failed",
  });
  expect(readResearchEvent(client, event.id)?.summary).not.toBe(
    "Changed summary",
  );
});

test("failed research, malformed output, and target mismatch never write", async () => {
  const { client, readSource } = fixture();
  const event = testFixtures(client).event({ canonicalName: "Example Fest" });
  const failed: ResearchCandidate = {
    status: "failed",
    data: null,
    errors: [{ code: "source_blocked", message: "Page blocked the read." }],
    unresolved: [],
  };
  for (const raw of [
    failed,
    { ...candidate([]), data: { ...candidate([]).data, eventId: "wrong-id" } },
    { legacy: "claims" },
  ]) {
    const result = await runCatalogResearch(
      { mode: "refresh", eventId: event.id, actor: input.actor },
      {
        client,
        readSource,
        generateCandidate: async () => raw,
      },
    );
    expect(result).toMatchObject({
      outcome: "failed",
      researchStatus: "failed",
      operations: [],
      changes: [],
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.sourceSummaries).toEqual([]);
  }
});

test.each([
  ["source", "not-a-url"],
  ["x", "not-a-url"],
] as const)(
  "malformed %s URL %s fails candidate validation after a source read without writing",
  async (field, malformedUrl) => {
    const { client, readSource } = fixture();
    const before = catalogState(client);
    const proposal = candidate([]);
    if (field === "source") {
      proposal.data!.sources[0].url = malformedUrl;
    } else {
      proposal.data!.links.socials.x = malformedUrl;
    }

    const result = await runCatalogResearch(
      { ...input, dryRun: false },
      {
        client,
        readSource,
        generateCandidate: async (_prompt, context) => {
          await context.readSource(url);
          return proposal;
        },
      },
    );

    expect(result).toMatchObject({
      outcome: "failed",
      researchStatus: "failed",
      operations: [],
      receipts: [],
      changes: [],
      sourceSummaries: [],
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "invalid_candidate",
        stage: "validation",
      }),
    );
    expect(result.modelResponse).toEqual({ text: null, object: proposal });
    expect(readSource).toHaveBeenCalledOnce();
    expect(result.sources).toEqual([
      {
        attemptedUrl: url,
        finalUrl: url,
        retrievedAt: source.retrievedAt,
        outcome: "ok",
      },
    ]);
    expect(catalogState(client)).toEqual(before);
  },
);

test("provider and budget failures keep sanitized errors and empty operations", async () => {
  const { client } = fixture();
  for (const error of [
    new Error("PRIVATE provider request"),
    new ResearchLimitError("pages"),
  ]) {
    const result = await runCatalogResearch(input, {
      client,
      generateCandidate: async () => {
        throw error;
      },
    });
    expect(result).toMatchObject({
      outcome: "failed",
      researchStatus: "failed",
      operations: [],
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        stage: "research",
        code:
          error instanceof ResearchLimitError
            ? "limit_reached"
            : "model_failed",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  }
});

test("source summaries respect the run page budget", async () => {
  const { client } = fixture();
  const proposal = candidate([]);
  proposal.data!.sources.push({
    url: "https://example.org/second",
    information: "Second source.",
  });
  const result = await runCatalogResearch(
    { ...input, limits: { pages: 1 } },
    { client, generateCandidate: async () => proposal },
  );
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "failed",
    operations: [],
    sourceSummaries: [],
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "invalid_candidate", stage: "validation" }),
  );
});
