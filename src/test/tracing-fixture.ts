import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "../db/connection";
import { testFixtures } from "./fixtures";
import { runCatalogResearch } from "../ingestion/workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../ingestion/runtime/budget";
import { readSource } from "../ingestion/sources/read-source";
import { discoverSources } from "../ingestion/sources/discover-sources";

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
  | "invalid_dates"
  | "dates"
  | "unchanged"
  | "search"
  | "reserved"
  | "writer"
  | "search_failure"
  | "target"
  | "skipped";

export const TRACE_CREDENTIAL = "PRIVATE_CONFIG_CREDENTIAL";
export const TRACE_SOURCE_BODY = "PRIVATE_SOURCE_BODY";
export const TRACE_CANDIDATE = "PRIVATE_CANDIDATE_EXPLANATION";
export const TRACE_TRANSPORT = "PRIVATE_TRANSPORT_ENVELOPE";
export const TRACE_ERROR = "PRIVATE_EXCEPTION_MESSAGE";

/** Real Mastra/OpenRouter adapter with an entirely offline provider and source. */
export async function runTraceFixture(
  ending: "success" | "http" | "abort" = "success",
  injected = false,
  scenario: TraceFixtureScenario = "failed",
  dryRun = false,
  modelText: {
    commentary?: string;
    reasoning?: string;
    cost?: number;
    searchStatus?: number;
    sourceErrorCount?: number;
  } = {},
) {
  const startedAt = Date.now();
  const config = {
    apiKey: TRACE_CREDENTIAL,
    model: "fixture/provider-model",
    limits: {
      ...DEFAULT_RESEARCH_LIMITS,
      agentSteps:
        scenario === "search" || scenario === "search_failure" ? 3 : 2,
      durationMs: ending === "abort" ? 500 : 30_000,
    },
  };

  const failedCandidate = {
    status: "failed",
    data: null,
    errors: [
      {
        code: "source_unavailable",
        message: TRACE_CANDIDATE,
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
    candidate = { unsafe: TRACE_CANDIDATE };
  } else {
    candidate = {
      status: scenario === "partial" ? "partial" : "success",
      data: {
        eventId: scenario === "target" ? "other-event" : event.id,
        eventName: "Model name mismatch",
        sources: [{ url: TRACE_PUBLIC_URL, information: TRACE_CANDIDATE }],
        links: { socials: {} },
        editions:
          scenario === "unchanged"
            ? []
            : [
                {
                  key: "2023",
                  links: {},
                  year: { value: 2023, reason: TRACE_CANDIDATE },
                  scheduleStatus: {
                    value: "cancelled",
                    reason: TRACE_CANDIDATE,
                  },
                },
              ],
      },
      errors:
        scenario === "target"
          ? Array.from({ length: modelText.sourceErrorCount ?? 0 }, () => ({
              code: "source_unavailable",
              message: TRACE_CANDIDATE,
            }))
          : [],
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
  addFixtureDateScenario(candidate, scenario);
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
        { error: { message: TRACE_TRANSPORT } },
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
        id: TRACE_TRANSPORT,
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
                    content: modelText.commentary ?? null,
                    ...(modelText.reasoning
                      ? { reasoning: modelText.reasoning }
                      : {}),
                    tool_calls: Array.from(
                      { length: scenario === "cached" ? 2 : 1 },
                      (_, index) => ({
                        id: `fixture-tool-${index}`,
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
                cost: modelText.cost ?? 0,
                prompt_tokens_details: { cached_tokens: 3 },
                completion_tokens_details: { reasoning_tokens: 4 },
              },
            }),
      },
      { headers: { "x-private-header": TRACE_TRANSPORT } },
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
                body: Buffer.from(`${TRACE_SOURCE_BODY} `.repeat(5_000)),
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
                ? `${TRACE_SOURCE_BODY} `.repeat(6_000)
                : TRACE_SOURCE_BODY,
            links: [],
          };
        },
        discoverSources: async (query, options) => {
          const { budget } = options;
          if (scenario === "search_failure") {
            return discoverSources(query, {
              ...options,
              fetch: async () =>
                Response.json(
                  { error: TRACE_TRANSPORT },
                  { status: modelText.searchStatus ?? 401 },
                ),
            });
          }
          budget.consumeSearch();
          return {
            query,
            candidates: [
              {
                url: TRACE_PUBLIC_URL,
                title: `${TRACE_PUBLIC_MARKER} programme`,
              },
            ],
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

export function readTraceRows(path: string) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "src/test/read-observability.ts", path],
      { encoding: "utf8" },
    ),
  ) as Record<string, Record<string, unknown>[]>;
}

if (process.argv[1]?.endsWith("/tracing-fixture.ts")) {
  if (process.argv[2] === "read") {
    process.stdout.write(
      JSON.stringify(
        readTraceRows(process.env.CATALOG_OBSERVABILITY_DATABASE_PATH!),
      ),
    );
  } else {
    runTraceFixture()
      .then((result) => process.stdout.write(JSON.stringify(result)))
      .catch(() => {
        process.exitCode = 1;
      });
  }
}

function addFixtureDateScenario(
  candidate: unknown,
  scenario: TraceFixtureScenario,
) {
  if (["dates", "invalid_dates"].includes(scenario)) {
    (candidate as { data: { editions: unknown[] } }).data.editions = [
      {
        key: "2026",
        links: {},
        year: { value: 2026, reason: TRACE_CANDIDATE },
        dates: {
          value: {
            startsOn: scenario === "invalid_dates" ? "bad-date" : "2026-07-01",
            endsOn: "2026-07-03",
            state: "confirmed",
          },
          reason: TRACE_CANDIDATE,
        },
      },
    ];
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
