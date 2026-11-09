import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import {
  runFixtureResearch,
  fixtureRoleGenerator,
  fixtureTargets,
  set,
  fixtureChecks,
} from "./ingestion";
import { fixtureRoleForProvider, providerRole } from "./ingestion-provider";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "../db/connection";
import { testFixtures } from "./fixtures";
import { runCatalogResearch } from "../ingestion/workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../ingestion/runtime/budget";
import { readPage } from "../ingestion/tools/read-page/read";
import { searchWeb } from "../ingestion/tools/search-web/search";

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
  | "invalid_editor"
  | "rejected_editor"
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
export const TRACE_HIGHLIGHT = "PRIVATE_SEARCH_HIGHLIGHT";
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
    stepCosts?: (number | null)[];
    model?: string;
    experimentId?: string;
    searchStatus?: number;
    searchUsage?: { cost?: number };
    onAbortRequest?: () => void;
  } = {},
) {
  const startedAt = Date.now();
  const config = {
    apiKey: TRACE_CREDENTIAL,
    model: modelText.model ?? "fixture/provider-model",
    limits: {
      ...DEFAULT_RESEARCH_LIMITS,
      agentSteps: fixtureAgentSteps(scenario),
      // This includes workflow/observability startup and the first model step.
      // Leave CI with coverage enough time to reach the hanging second request.
      durationMs: ending === "abort" ? 5_000 : 30_000,
    },
  };

  const directory = mkdtempSync(join(tmpdir(), "trace-catalog-"));
  const { client, db } = openDatabase(join(directory, "catalog.sqlite"));
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  const fixtures = testFixtures(client);
  const event = fixtures.event({
    id: "trace-fixture",
    canonicalName: TRACE_PUBLIC_MARKER,
  });
  fixtures.edition(event, { editionYear: 2026, editionKey: "2026" });
  fixtures.link(
    { event },
    {
      url: "https://example.org/initial",
      kind: "official_site",
      official: true,
    },
  );
  const general = fixtureTargets(
    scenario === "target" ? "other-event" : event.id,
  );
  general.observedEventName = "Model name mismatch";
  general.reason = TRACE_CANDIDATE;
  general.currentOrNextEdition =
    scenario === "unchanged"
      ? null
      : {
          editionKey: "2023",
          reason: TRACE_CANDIDATE,
          evidenceIds: ["s2-e1"],
          fields: {
            year: set(2027, TRACE_CANDIDATE, ["s2-e1"]),
            scheduleStatus: set("announced", TRACE_CANDIDATE, ["s2-e1"]),
          },
        };
  general.evidenceIds = ["s2-e1"];
  if (["dates", "invalid_dates"].includes(scenario)) {
    general.currentOrNextEdition = {
      editionKey: "2026",
      reason: TRACE_CANDIDATE,
      evidenceIds: ["s2-e1"],
      fields: {
        year: set(2026, TRACE_CANDIDATE, ["s2-e1"]),
        dates: set(
          {
            startsOn: scenario === "invalid_dates" ? "bad-date" : "2026-07-01",
            endsOn: "2026-07-03",
            state: "confirmed",
          },
          TRACE_CANDIDATE,
          ["s2-e1"],
        ),
      },
    };
  }
  const responses = {
    general: async (_role: unknown, raw: string) => {
      if (["failed", "cached", "search", "reserved"].includes(scenario)) {
        return {
          decision: "uncertain",
          reason: TRACE_CANDIDATE,
          unresolved: [],
        };
      }
      if (scenario === "invalid") {
        return { unsafe: TRACE_CANDIDATE };
      }
      if (scenario === "skipped") {
        return {
          decision: "duplicate",
          eventId: event.id,
          observedEventName: general.observedEventName,
          reason: TRACE_CANDIDATE,
          evidenceIds: ["s1-e1"],
        };
      }
      const prompt = JSON.parse(raw);
      return {
        ...general,
        checks: fixtureChecks(
          prompt.assignedChecks,
          ["partial", "rejected_editor"].includes(scenario)
            ? "unfinished"
            : "verified",
        ),
        unresolved: ["partial", "rejected_editor"].includes(scenario)
          ? [{ message: "Current edition blocked" }]
          : [],
      };
    },
    reader: async (_role: unknown, raw: string) => {
      const prompt = JSON.parse(raw);
      return {
        overview: TRACE_CANDIDATE,
        coverage: { found: [], notPublished: [] },
        topics: ["identity", "dates", "status", "classification", "location"],
        statedYears: [],
        limitations: [],
        evidence:
          prompt.page.length <= 24000
            ? [
                {
                  quote: prompt.page,
                  topics: [
                    "identity",
                    "dates",
                    "status",
                    "classification",
                    "location",
                  ],
                },
              ]
            : [],
      };
    },
  };
  let requests = 0;
  let researchRequests = 0;
  const providerInputs: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_request, init) => {
    if (!_request.toString().includes("openrouter.ai")) {
      throw new Error("Live network forbidden");
    }
    providerInputs.push(String(init?.body));
    requests++;
    const body = JSON.parse(String(init?.body));
    const role = providerRole(body);
    if (role === "research") {
      researchRequests += 1;
    }
    const toolCall = role === "research" && researchRequests === 1;
    const candidate =
      role === "editor" && scenario === "invalid_editor"
        ? { decisions: [], event: { target: { eventId: "other-event" } } }
        : await fixtureRoleForProvider(body, responses);
    if (role === "research" && researchRequests === 2 && ending === "http") {
      return Response.json(
        { error: { message: TRACE_TRANSPORT } },
        { status: 503 },
      );
    }
    if (role === "research" && researchRequests === 2 && ending === "abort") {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
        } else {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }
        modelText.onAbortRequest?.();
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
            message: toolCall
              ? {
                  role: "assistant",
                  content: modelText.commentary ?? null,
                  ...(modelText.reasoning
                    ? { reasoning: modelText.reasoning }
                    : {}),
                  tool_calls: [
                    ...Array.from(
                      { length: scenario === "cached" ? 2 : 1 },
                      (_, index) => ({
                        id: `fixture-tool-${index}`,
                        type: "function",
                        function: {
                          name:
                            scenario === "search" ||
                            scenario === "reserved" ||
                            scenario === "search_failure"
                              ? "searchWeb"
                              : "inspectPage",
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
                  ],
                }
              : {
                  role: "assistant",
                  content: JSON.stringify(
                    rejectedEditorFixture(candidate, role, scenario),
                  ),
                },
            finish_reason: toolCall ? "tool_calls" : "stop",
          },
        ],
        ...(scenario === "mistaken" && requests === 2
          ? {}
          : {
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
                ...fixtureCost(
                  modelText.cost,
                  modelText.stepCosts,
                  role === "research" ? researchRequests : 0,
                ),
                prompt_tokens_details: { cached_tokens: 3 },
                completion_tokens_details: { reasoning_tokens: 4 },
              },
            }),
      },
      { headers: { "x-private-header": TRACE_TRANSPORT } },
    );
  };
  const workflowStorage = createWorkflowStorage({ path: ":memory:" });
  try {
    const result = await (injected ? runFixtureResearch : runCatalogResearch)(
      {
        mode: scenario === "skipped" ? "add" : "refresh",
        ...(scenario === "skipped"
          ? { input: TRACE_PUBLIC_MARKER }
          : { eventId: event.id }),
        actor: "test",
        initiatedBy: "test",
        dryRun,
      },
      {
        client,
        workflowStorage,
        config,
        experimentId: modelText.experimentId,
        readPage: async (url, { budget }) => {
          if (scenario === "truncated" && !url.endsWith("/initial")) {
            return readPage(url, {
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
            status: url.endsWith("/initial") ? "failed" : "ok",
            ...(url.endsWith("/initial")
              ? {
                  reasonCode:
                    scenario === "recovered"
                      ? "oversized_response"
                      : "request_failed",
                }
              : {}),
            markdown:
              scenario === "tool_truncated" && !url.endsWith("/initial")
                ? `${TRACE_SOURCE_BODY} `.repeat(6_000)
                : TRACE_SOURCE_BODY,
          };
        },
        searchWeb: async (query, options) => {
          const { budget } = options;
          if (scenario === "search_failure") {
            return searchWeb(query, {
              ...options,
              fetch: async () =>
                Response.json(
                  { error: TRACE_TRANSPORT },
                  { status: modelText.searchStatus ?? 401 },
                ),
            });
          }
          if (modelText.searchUsage) {
            return searchWeb(query, {
              ...options,
              fetch: async () =>
                Response.json({
                  choices: [{ message: {} }],
                  usage: {
                    prompt_tokens: 42,
                    completion_tokens: 8,
                    ...modelText.searchUsage,
                  },
                }),
            });
          }
          budget.consumeSearch();
          return {
            query,
            candidates: [
              {
                url: TRACE_PUBLIC_URL,
                title: `${TRACE_PUBLIC_MARKER} programme`,
                highlights: [TRACE_HIGHLIGHT],
              },
            ],
            retrievedAt: "2026-10-09T00:00:00Z",
            modelCostUsd: null,
            searchCostUsd: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
        },
        ...(injected ? { generateRole: fixtureRoleGenerator(responses) } : {}),
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
        "SELECT edition_key,edition_year,schedule_status FROM editions ORDER BY edition_key",
      )
      .all();
    return {
      result,
      requests,
      budget: result.budget,
      durationMs: Date.now() - startedAt,
      durableReport: JSON.parse(row.report_json),
      effects,
    };
  } finally {
    await workflowStorage.close();
    globalThis.fetch = original;
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

export { readTraceRows } from "./read-observability";

if (process.argv[1]?.endsWith("/tracing-fixture.ts")) {
  if (process.argv[2] === "read") {
    import("./read-observability").then(async ({ readTraceRows }) => {
      process.stdout.write(
        JSON.stringify(
          await readTraceRows(process.env.CATALOG_OBSERVABILITY_DATABASE_PATH!),
        ),
      );
    });
  } else {
    runTraceFixture()
      .then((result) => process.stdout.write(JSON.stringify(result)))
      .catch(() => {
        process.exitCode = 1;
      });
  }
}

function fixtureCost(
  cost: number | undefined,
  stepCosts: (number | null)[] | undefined,
  request: number,
) {
  let selected: number | null | undefined = cost ?? 0;
  if (stepCosts) {
    selected = request === 0 ? 0 : stepCosts[request - 1];
  }
  return selected == null ? {} : { cost: selected };
}

function rejectedEditorFixture(
  candidate: Record<string, unknown>,
  role: string,
  scenario: TraceFixtureScenario,
) {
  if (role !== "editor" || scenario !== "rejected_editor") {
    return candidate;
  }
  return {
    decisions: (
      candidate.decisions as import("@/ingestion/roles/editor/contracts").ReviewDecision[]
    ).map((entry) =>
      entry.path === "item"
        ? {
            ...entry,
            decision: "reject",
            note: "Research concerns a different same-name festival",
          }
        : entry,
    ),
  };
}

function fixtureAgentSteps(scenario: TraceFixtureScenario) {
  return ["search", "search_failure"].includes(scenario) ? 3 : 2;
}
