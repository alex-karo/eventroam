import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "../db/connection";
import { testFixtures } from "./fixtures";
import { runCatalogResearch } from "../ingestion/workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../ingestion/runtime/budget";
import { readSource } from "../ingestion/sources/read-source";

export const TRACE_PUBLIC_MARKER = "PUBLIC_FESTIVAL";
export const TRACE_PUBLIC_URL = `https://example.org/${TRACE_PUBLIC_MARKER}?token=public-value#programme`;
export type TraceFixtureScenario =
  | "failed"
  | "cached"
  | "truncated"
  | "tool_truncated"
  | "partial"
  | "mistaken"
  | "recovered"
  | "invalid"
  | "unchanged"
  | "search"
  | "reserved"
  | "writer"
  | "search_failure"
  | "target"
  | "skipped";

export const TRACE_SENTINEL = "PRIVATE_TRACE_CONTENT_SENTINEL";

/** Real Mastra/OpenRouter adapter with an entirely offline provider and source. */
export async function runTraceFixture(
  ending: "success" | "http" | "abort" = "success",
  injected = false,
  scenario: TraceFixtureScenario = "failed",
  dryRun = false,
) {
  const startedAt = Date.now();
  const config = {
    apiKey: TRACE_SENTINEL,
    model: "fixture/provider-model",
    limits: {
      ...DEFAULT_RESEARCH_LIMITS,
      modelCalls:
        scenario === "search" || scenario === "search_failure" ? 4 : 3,
      durationMs: ending === "abort" ? 500 : 30_000,
    },
  };

  const failedCandidate = {
    status: "failed",
    data: null,
    errors: [
      {
        code: "source_unavailable",
        message: TRACE_SENTINEL,
        url: null,
        editionKey: null,
        field: null,
      },
    ],
    unresolved: [],
  };
  const directory = mkdtempSync(join(tmpdir(), "trace-catalog-"));
  const { client, db } = openDatabase(join(directory, "catalog.sqlite"));
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  const fixtures = testFixtures(client);
  const event = fixtures.event({
    id: "trace-fixture",
    canonicalName: TRACE_PUBLIC_MARKER,
  });
  fixtures.occurrence(event, { occurrenceYear: 2026, occurrenceKey: "2026" });
  fixtures.link(
    { event },
    {
      url: "https://example.org/initial",
      kind: "official_site",
      official: true,
    },
  );
  let candidate: unknown;
  if (
    scenario === "failed" ||
    scenario === "cached" ||
    scenario === "search" ||
    scenario === "reserved"
  ) {
    candidate = failedCandidate;
  } else if (scenario === "invalid") {
    candidate = { unsafe: TRACE_SENTINEL };
  } else {
    candidate = {
      status: scenario === "partial" ? "partial" : "success",
      data: {
        eventId: scenario === "target" ? "other-event" : event.id,
        eventName: "Model name mismatch",
        sources: [{ url: TRACE_PUBLIC_URL, information: TRACE_SENTINEL }],
        links: { socials: {} },
        editions:
          scenario === "unchanged"
            ? []
            : [
                {
                  key: "2023",
                  links: {},
                  year: { value: 2023, reason: TRACE_SENTINEL },
                  scheduleStatus: {
                    value: "cancelled",
                    reason: TRACE_SENTINEL,
                  },
                },
              ],
      },
      errors: [],
      unresolved:
        scenario === "partial"
          ? [
              {
                message: "Current edition blocked",
              },
            ]
          : [],
    };
  }
  candidate = withTicketRouting(candidate);
  let requests = 0;
  const providerInputs: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_request, init) => {
    if (!_request.toString().includes("openrouter.ai")) {
      throw new Error("Live network forbidden");
    }
    providerInputs.push(String(init?.body));
    requests++;
    if (requests === 2 && ending === "http") {
      return Response.json(
        { error: { message: TRACE_SENTINEL } },
        { status: 503 },
      );
    }
    if (requests === 2 && ending === "abort") {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
        } else {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }
      });
    }
    return Response.json(
      {
        id: TRACE_SENTINEL,
        object: "chat.completion",
        created: 1,
        model: config.model,
        choices: [
          {
            index: 0,
            message:
              requests === 1
                ? {
                    role: "assistant",
                    content: null,
                    tool_calls: Array.from(
                      { length: scenario === "cached" ? 2 : 1 },
                      (_, index) => ({
                        id: `${TRACE_SENTINEL}_${index}`,
                        type: "function",
                        function: {
                          name:
                            scenario === "search" ||
                            scenario === "reserved" ||
                            scenario === "search_failure"
                              ? "discoverSources"
                              : "readSource",
                          arguments: JSON.stringify(
                            scenario === "search" ||
                              scenario === "reserved" ||
                              scenario === "search_failure"
                              ? { query: `Festival ${TRACE_PUBLIC_URL}` }
                              : { url: TRACE_PUBLIC_URL },
                          ),
                        },
                      }),
                    ),
                  }
                : {
                    role: "assistant",
                    content: JSON.stringify(
                      wireFixture(
                        candidate,
                        JSON.parse(String(init?.body)).response_format
                          ?.json_schema?.schema,
                      ),
                    ),
                  },
            finish_reason: requests === 1 ? "tool_calls" : "stop",
          },
        ],
        ...(scenario === "mistaken" && requests === 2
          ? {}
          : {
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
                cost: 0,
                prompt_tokens_details: { cached_tokens: 3 },
                completion_tokens_details: { reasoning_tokens: 4 },
              },
            }),
      },
      { headers: { "x-private-header": TRACE_SENTINEL } },
    );
  };
  try {
    const result = await runCatalogResearch(
      {
        mode: scenario === "skipped" ? "add" : "check",
        ...(scenario === "skipped"
          ? { name: TRACE_PUBLIC_MARKER }
          : { eventId: event.id }),
        actor: "test",
        initiatedBy: "test",
        dryRun,
      },
      {
        client,
        config,
        readSource: async (url, { budget }) => {
          if (scenario === "truncated" && !url.endsWith("/initial")) {
            return readSource(url, {
              budget,
              now: () => new Date("2026-10-09T00:00:00Z"),
              request: async () => ({
                finalUrl: url,
                status: 200,
                contentType: "text/plain",
                body: Buffer.from(`${TRACE_SENTINEL} `.repeat(1_000)),
              }),
            });
          }
          budget.consumePage();
          return {
            attemptedUrl: url,
            finalUrl: url,
            retrievedAt: "2026-10-09T00:00:00Z",
            method: "http",
            outcome: url.endsWith("/initial") ? "failed" : "ok",
            ...(url.endsWith("/initial")
              ? {
                  reason:
                    scenario === "recovered"
                      ? "oversized_response"
                      : "request_failed",
                }
              : {}),
            completeness: url.endsWith("/initial") ? "none" : "full",
            sourceTruncated: false,
            markdown:
              scenario === "tool_truncated" && !url.endsWith("/initial")
                ? `${TRACE_SENTINEL} `.repeat(3_000)
                : TRACE_SENTINEL,
            links: [],
          };
        },
        discoverSources: async (query, { budget }) => {
          if (scenario === "search_failure") {
            throw new Error(TRACE_SENTINEL);
          }
          budget.consumeSearch();
          return {
            query,
            candidates: [{ url: TRACE_PUBLIC_URL, title: TRACE_SENTINEL }],
            retrievedAt: "2026-10-09T00:00:00Z",
            modelCostUsd: null,
            searchCostUsd: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
        },
        ...(injected ? { generateCandidate: async () => candidate } : {}),
      },
    );
    const runId = result.runId;
    if (!runId) {
      throw new Error("Workflow returned no run ID");
    }
    if (providerInputs.some((body) => body.includes(runId))) {
      throw new Error("Internal run ID reached provider input");
    }
    const row = client
      .prepare("SELECT report_json FROM ingestion_runs WHERE id=?")
      .get(result.runId) as { report_json: string };
    const effects = client
      .prepare(
        "SELECT occurrence_key,occurrence_year,schedule_status FROM occurrences ORDER BY occurrence_key",
      )
      .all();
    return {
      result,
      requests,
      budget: result.usage,
      durationMs: Date.now() - startedAt,
      durableReport: JSON.parse(row.report_json),
      effects,
    };
  } finally {
    globalThis.fetch = original;
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function withTicketRouting(value: unknown) {
  const routed = value as {
    data?: { editions: Record<string, unknown>[] } | null;
  };
  if (routed.data) {
    for (const edition of routed.data.editions) {
      Object.assign(edition, {
        ticketResearch: {
          state: "not_found",
          sourceUrls: [],
          reason: "No ticket information on inspected pages",
        },
      });
    }
  }
  return value;
}

export function readTraceRows(path: string) {
  const db = new Database(path, { readonly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const rows = Object.fromEntries(
      tables.map(({ name }) => [
        name,
        (
          db
            .prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`)
            .all() as Record<string, unknown>[]
        ).map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
              if (!Buffer.isBuffer(value)) {
                return [key, value];
              }
              // Mastra's JSON fields use SQLite JSONB; inspect the decoded content too.
              try {
                return [
                  key,
                  (
                    db.prepare("SELECT json(?) value").get(value) as {
                      value: string;
                    }
                  ).value,
                ];
              } catch {
                return [key, value.toString("utf8")];
              }
            }),
          ),
        ),
      ]),
    );
    return rows;
  } finally {
    db.close();
  }
}

if (process.argv[1]?.endsWith("/tracing-fixture.ts")) {
  if (process.argv[2] === "read") {
    process.stdout.write(
      JSON.stringify(readTraceRows(process.env.CATALOG_TRACE_DATABASE_PATH!)),
    );
  } else {
    runTraceFixture()
      .then((result) => process.stdout.write(JSON.stringify(result)))
      .catch(() => {
        process.exitCode = 1;
      });
  }
}

function wireFixture(
  value: unknown,
  schema: Record<string, unknown> | undefined,
): unknown {
  if (value == null || !schema) {
    return value;
  }
  const choices = schema.anyOf as Record<string, unknown>[] | undefined;
  if (choices) {
    const type = Array.isArray(value) ? "array" : typeof value;
    return wireFixture(
      value,
      choices.find((choice) => choice.type === type) ?? choices[0],
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      wireFixture(item, schema.items as Record<string, unknown>),
    );
  }
  if (typeof value !== "object") {
    return value;
  }
  const properties = schema.properties as
    Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(properties).map(([key, property]) => [
      key,
      wireFixture((value as Record<string, unknown>)[key] ?? null, property),
    ]),
  );
}
