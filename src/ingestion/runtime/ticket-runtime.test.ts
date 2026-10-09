import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { wireCandidate } from "@/test/research-wire-fixture";
import { readResearchEvent } from "@/catalog/read/research";
import { readTraceRows } from "@/test/tracing-fixture";
import { runCatalogResearch } from "../workflow";
import * as prepareModule from "../research/prepare";
import { DEFAULT_RESEARCH_LIMITS } from "./budget";
import {
  RESEARCH_PROMPT_VERSION,
  TICKET_PROMPT_VERSION,
} from "../research/contracts";

const sentinel = "PRIVATE_TICKET_SENTINEL";
const url = "https://example.org/tickets";
const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  for (const path of dirs.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});
function setup(tracing = false) {
  const client = testDatabase().client;
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Fixture" });
  fx.eventLink(event, { kind: "official_site", url, official: true });
  fx.occurrence(event, {
    occurrenceKey: "2027",
    venueName: "Old venue",
    priceKind: "exact",
    priceCurrency: "EUR",
    priceMinMinor: 5000,
    priceMaxMinor: 5000,
    priceCoverage: "full_programme",
  });
  const dir = mkdtempSync(join(tmpdir(), "ticket-runtime-"));
  dirs.push(dir);
  const path = join(dir, "traces.sqlite");
  vi.stubEnv("CATALOG_TRACING", String(tracing));
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", path);
  const main = {
    status: "success",
    errors: [],
    unresolved: [],
    data: {
      eventId: event.id,
      eventName: "Fixture",
      sources: [{ url, information: sentinel }],
      links: { socials: {} },
      editions: [
        {
          key: "2027",
          venueName: { value: "New venue", reason: sentinel },
          links: {},
          ticketResearch: {
            state: "inspect",
            sourceUrls: [url],
            reason: sentinel,
          },
        },
      ],
    },
  };
  const tickets = {
    editions: [
      {
        key: "2027",
        tickets: {
          reason: sentinel,
          value: {
            variants: [{ label: "General", amount: 100, currency: "EUR" }],
            basePrice: {
              kind: "exact",
              currency: "EUR",
              minAmount: 100,
              maxAmount: 100,
              coverage: "full_programme",
            },
          },
        },
        unresolved: [],
      },
    ],
  };
  const config = {
    apiKey: sentinel,
    model: "fixture/provider-model",
    limits: { ...DEFAULT_RESEARCH_LIMITS, modelCalls: 3 },
    reasoningEffort: "high" as const,
    serviceTier: "flex" as const,
  };
  const input = {
    mode: "refresh" as const,
    eventId: event.id,
    actor: "test",
    dryRun: false,
  };
  const readSource = async (
    _url: string,
    options: {
      budget: { consumePage: (depth?: number) => void };
      depth?: number;
    },
  ) => {
    options.budget.consumePage(options.depth);
    return {
      attemptedUrl: url,
      finalUrl: url,
      retrievedAt: "2026-10-09T00:00:00Z",
      method: "http" as const,
      outcome: "ok" as const,
      completeness: "full" as const,
      markdown: sentinel,
      links: [],
    };
  };
  return { client, event, main, tickets, input, config, readSource, path };
}
function response(value: unknown, init?: RequestInit) {
  value = wireCandidate(JSON.parse(String(init?.body)), value);
  return Response.json({
    id: sentinel,
    object: "chat.completion",
    created: 1,
    model: "fixture/provider-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(value) },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      cost: 0,
      prompt_tokens_details: { cached_tokens: 3 },
      completion_tokens_details: { reasoning_tokens: 4 },
    },
  });
}
function unavailable() {
  return Response.json(
    {
      error: {
        code: 502,
        message: sentinel,
        metadata: { error_type: "provider_unavailable" },
      },
    },
    { status: 502 },
  );
}

test("two real agents share Mastra; distinct sanitized stage spans and cleanup follow atomic write", async () => {
  const fx = setup(true);
  const instances: Mastra[] = [];
  const originalAdd = Mastra.prototype.addAgent;
  vi.spyOn(Mastra.prototype, "addAgent").mockImplementation(function (
    this: Mastra,
    ...args: Parameters<typeof originalAdd>
  ) {
    instances.push(this);
    return originalAdd.apply(this, args);
  });
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return response(requests.length === 1 ? fx.main : fx.tickets, init);
    }),
  );
  const shutdown = Mastra.prototype.shutdown;
  const closed = vi
    .spyOn(Mastra.prototype, "shutdown")
    .mockImplementation(async function (this: Mastra) {
      expect(
        readResearchEvent(fx.client, fx.event.id)!.editions[0].priceMinMinor,
      ).toBe(10000);
      await shutdown.call(this);
    });
  const result = await runCatalogResearch(fx.input, fx);
  const row = fx.client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(result.runId) as {
    report_json: string;
    status: string;
    input_tokens: number;
    output_tokens: number;
  };
  expect(row).toMatchObject({
    status: "completed",
    input_tokens: 20,
    output_tokens: 40,
  });
  expect(JSON.parse(row.report_json)).toEqual(result);
  expect(JSON.stringify(requests)).not.toContain(result.runId);
  expect(instances).toHaveLength(2);
  expect(instances[0]).toBe(instances[1]);
  expect(closed).toHaveBeenCalledOnce();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({
    reasoning: { effort: "high" },
    service_tier: "flex",
  });
  expect(requests[1].tools).toBeUndefined();
  expect(requests[1].plugins).toBeUndefined();
  expect(result.usage).toMatchObject({
    modelCalls: 2,
    complete: true,
    inputTokens: 20,
    outputTokens: 40,
    cachedInputTokens: 6,
    reasoningTokens: 8,
    modelCostUsd: 0,
  });
  expect(result.ticketResearch).toMatchObject({
    outcome: "completed",
    usage: { complete: true, modelCostUsd: 0 },
  });
  const rows = readTraceRows(fx.path);
  expect(JSON.stringify(rows)).not.toContain(sentinel);
  const spans = rows.mastra_ai_spans as {
    spanId: string;
    parentSpanId: string | null;
    entityId: string;
    metadata: string;
    traceId: string;
  }[];
  const roots = spans.filter((span) => !span.parentSpanId);
  expect(roots.map((span) => span.entityId)).toEqual(["catalog-research"]);
  const agents = spans.filter((span) =>
    ["festival-research", "ticket-research"].includes(span.entityId),
  );
  expect(agents.map((span) => span.entityId)).toEqual(
    expect.arrayContaining(["festival-research", "ticket-research"]),
  );
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  for (const agent of agents) {
    expect(agent.parentSpanId).toBe(roots[0].spanId);
    const version =
      agent.entityId === "ticket-research"
        ? TICKET_PROMPT_VERSION
        : RESEARCH_PROMPT_VERSION;
    for (const span of spans) {
      let parent = span;
      while (
        parent !== agent &&
        parent.parentSpanId &&
        byId.has(parent.parentSpanId)
      ) {
        parent = byId.get(parent.parentSpanId)!;
      }
      if (parent === agent) {
        expect(JSON.parse(span.metadata)).toMatchObject({
          promptVersion: version,
          runId: result.runId,
        });
      }
    }
  }
});

test("specialist provider_unavailable has one attempt, spent capacity and preserved non-ticket write", async () => {
  const fx = setup();
  const fetch = vi
    .fn()
    .mockImplementationOnce(async (_url, init) => response(fx.main, init))
    .mockResolvedValueOnce(unavailable());
  vi.stubGlobal("fetch", fetch);
  const result = await runCatalogResearch(fx.input, fx);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({
    researchStatus: "success",
    outcome: "updated",
    ticketResearch: { outcome: "failed" },
    usage: {
      modelCalls: 2,
      complete: false,
      inputTokens: 10,
      outputTokens: 20,
      modelCostUsd: null,
    },
  });
  expect(readResearchEvent(fx.client, fx.event.id)!.editions[0]).toMatchObject({
    priceMinMinor: 5000,
    venueName: "New venue",
  });
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "model_failed",
      field: "tickets",
      diagnostic: expect.objectContaining({ httpStatus: 502 }),
    }),
  );
});

test("main unavailable retries preserve ticket reservation and do not replay initial read", async () => {
  vi.useFakeTimers();
  const fx = setup();
  const read = vi.fn(fx.readSource);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(unavailable())
    .mockImplementationOnce(async (_url, init) => response(fx.main, init))
    .mockImplementationOnce(async (_url, init) => response(fx.tickets, init));
  vi.stubGlobal("fetch", fetch);
  const run = runCatalogResearch(fx.input, { ...fx, readSource: read });
  await vi.advanceTimersByTimeAsync(10_000);
  const result = await run;
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(read).toHaveBeenCalledOnce();
  expect(result).toMatchObject({
    researchStatus: "success",
    ticketResearch: { outcome: "completed" },
    usage: {
      modelCalls: 2,
      complete: false,
      inputTokens: 20,
      modelCostUsd: null,
    },
  });
});

test("all injected stages create no store; skipped/injected main allows a real specialist trace", async () => {
  const fx = setup(true);
  await runCatalogResearch(fx.input, {
    ...fx,
    generateCandidate: async () => fx.main,
    generateTickets: async () => fx.tickets,
  });
  expect(existsSync(fx.path)).toBe(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => response(fx.tickets, init)),
  );
  await runCatalogResearch(fx.input, {
    ...fx,
    generateCandidate: async () => fx.main,
  });
  const spans = readTraceRows(fx.path).mastra_ai_spans as {
    entityId: string | null;
  }[];
  expect(spans.some((span) => span.entityId === "ticket-research")).toBe(true);
  expect(spans.some((span) => span.entityId === "festival-research")).toBe(
    false,
  );
});

test("deadline aborts injected specialist but deterministic write still completes", async () => {
  vi.useFakeTimers();
  const fx = setup();
  fx.config.limits.durationMs = 100;
  const run = runCatalogResearch(fx.input, {
    ...fx,
    generateCandidate: async () => fx.main,
    generateTickets: async () => new Promise<unknown>(() => {}),
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await run;
  expect(result).toMatchObject({
    researchStatus: "success",
    outcome: "updated",
    ticketResearch: { outcome: "limited" },
    usage: { modelCalls: 2 },
  });
  expect(readResearchEvent(fx.client, fx.event.id)!.editions[0]).toMatchObject({
    priceMinMinor: 5000,
    venueName: "New venue",
  });
});

test("cleanup crossing deadline preserves generation success and total wall time includes cleanup", async () => {
  const fx = setup(true);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementationOnce(async (_url, init) => response(fx.main, init))
      .mockImplementationOnce(async (_url, init) => response(fx.tickets, init)),
  );
  const flush = Observability.prototype.flush;
  const now = Date.now;
  vi.spyOn(Observability.prototype, "flush").mockImplementation(async function (
    this: Observability,
  ) {
    await flush.call(this);
    vi.spyOn(Date, "now").mockReturnValue(now() + 360_000);
  });
  const result = await runCatalogResearch(fx.input, fx);
  expect(result.researchStatus).toBe("success");
  expect(result.ticketResearch?.outcome).toBe("completed");
  expect(result.durationMs).toBeGreaterThanOrEqual(360_000);
});
test.each([
  [300_000, 4],
  [25_000, 2],
])(
  "main unavailable retry cap/backoff stay within original %ims deadline",
  async (durationMs, attempts) => {
    vi.useFakeTimers();
    const fx = setup();
    fx.config.limits.durationMs = durationMs;
    const read = vi.fn(fx.readSource);
    const started = Date.now();
    const times: number[] = [];
    const fetch = vi.fn(async () => {
      times.push(Date.now() - started);
      return Response.json(
        {
          error: {
            code: 502,
            message: sentinel,
            metadata: { error_type: "provider_unavailable" },
          },
        },
        { status: 502 },
      );
    });
    vi.stubGlobal("fetch", fetch);
    const run = runCatalogResearch(fx.input, { ...fx, readSource: read });
    await vi.advanceTimersByTimeAsync(durationMs);
    const result = await run;
    expect(fetch).toHaveBeenCalledTimes(attempts);
    expect(times).toEqual([0, 10_000, 40_000, 130_000].slice(0, attempts));
    expect(read).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      researchStatus: "failed",
      ticketResearch: { outcome: "skipped" },
      usage: { modelCalls: 0, complete: false, modelCostUsd: null },
    });
  },
);

test("preparation failure preserves completed ticket usage in the durable failed run", async () => {
  const fx = setup();
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) =>
      response(++calls === 1 ? fx.main : fx.tickets, init),
    ),
  );
  vi.spyOn(prepareModule, "prepareResearch").mockImplementationOnce(() => {
    throw new Error("SECRET");
  });
  const result = await runCatalogResearch(fx.input, fx);
  expect(result).toMatchObject({
    outcome: "failed",
    researchStatus: "success",
    ticketResearch: { outcome: "completed" },
    usage: {
      modelCalls: 2,
      inputTokens: 20,
      outputTokens: 40,
      modelCostUsd: 0,
    },
  });
  expect(result.errors).toContainEqual({
    code: "workflow_failed",
    stage: "workflow",
    message: "Ingestion workflow failed",
  });
  const row = fx.client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(result.runId) as {
    report_json: string;
    status: string;
    input_tokens: number;
  };
  expect(row).toMatchObject({ status: "failed", input_tokens: 20 });
  expect(JSON.parse(row.report_json)).toEqual(result);
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(
    readResearchEvent(fx.client, fx.event.id)!.editions[0].priceMinMinor,
  ).toBe(5000);
});

test.each([
  [true, false],
  [false, true],
  [true, true],
])(
  "injected main=%s and tickets=%s trace only real stages under one root",
  async (mainInjected, ticketInjected) => {
    const fx = setup(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) =>
        response(mainInjected ? fx.tickets : fx.main, init),
      ),
    );
    const result = await runCatalogResearch(fx.input, {
      ...fx,
      ...(mainInjected ? { generateCandidate: async () => fx.main } : {}),
      ...(ticketInjected ? { generateTickets: async () => fx.tickets } : {}),
    });
    expect(result).toMatchObject({
      researchStatus: "success",
      ticketResearch: { outcome: "completed" },
    });
    if (mainInjected && ticketInjected) {
      expect(existsSync(fx.path)).toBe(false);
    } else {
      const spans = readTraceRows(fx.path).mastra_ai_spans as {
        entityId: string;
        parentSpanId: string | null;
        metadata: string;
        name: string;
      }[];
      expect(spans.filter((span) => !span.parentSpanId)).toHaveLength(1);
      expect(
        spans
          .filter((span) =>
            ["festival-research", "ticket-research"].includes(span.entityId),
          )
          .map((span) => span.entityId),
      ).toEqual([mainInjected ? "ticket-research" : "festival-research"]);
      expect(
        spans.every((span) => JSON.parse(span.metadata).runId === result.runId),
      ).toBe(true);
      expect(spans.find((span) => !span.parentSpanId)?.name).toContain(
        "Fixture",
      );
    }
  },
);
