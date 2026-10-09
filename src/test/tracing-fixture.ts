import Database from "better-sqlite3";
import { researchFestival } from "../ingestion/research/agent";
import {
  createResearchBudget,
  DEFAULT_RESEARCH_LIMITS,
} from "../ingestion/runtime/budget";
import { createSourceSession } from "../ingestion/sources/session";

const runAgent = researchFestival;

export const TRACE_SENTINEL = "PRIVATE_TRACE_CONTENT_SENTINEL";

/** Real Mastra/OpenRouter adapter with an entirely offline provider and source. */
export async function runTraceFixture(
  ending: "success" | "http" | "abort" = "success",
  injected = false,
  runId = "trace-fixture-run",
) {
  const startedAt = Date.now();
  const config = {
    apiKey: TRACE_SENTINEL,
    model: "fixture/provider-model",
    limits: {
      ...DEFAULT_RESEARCH_LIMITS,
      modelCalls: 2,
      durationMs: ending === "abort" ? 500 : 30_000,
    },
  };
  const budget = createResearchBudget(config.limits);
  const candidate = {
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
  let requests = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (_request, init) => {
    if (String(init?.body).includes(runId)) {
      throw new Error("Internal run ID reached provider input");
    }
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
                    tool_calls: [
                      {
                        id: TRACE_SENTINEL,
                        type: "function",
                        function: {
                          name: "readSource",
                          arguments: JSON.stringify({
                            url: `https://example.org/${TRACE_SENTINEL}`,
                          }),
                        },
                      },
                    ],
                  }
                : { role: "assistant", content: JSON.stringify(candidate) },
            finish_reason: requests === 1 ? "tool_calls" : "stop",
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
      },
      { headers: { "x-private-header": TRACE_SENTINEL } },
    );
  };
  const sources = createSourceSession(budget, config, [], {
    readSource: async (url) => {
      budget.consumePage();
      return {
        attemptedUrl: url,
        finalUrl: url,
        retrievedAt: "2026-10-09T00:00:00Z",
        method: "http",
        outcome: "ok",
        completeness: "full",
        markdown: TRACE_SENTINEL,
        links: [],
      };
    },
  });
  try {
    const result = await runAgent(
      {
        mode: "refresh",
        eventId: "trace-fixture",
        name: TRACE_SENTINEL,
        actor: "test",
        initiatedBy: "test",
      },
      { catalog: [], terms: [], knownLinks: [] },
      sources,
      budget,
      config,
      injected ? { generateCandidate: async () => candidate } : {},
      runId,
    );
    return {
      result,
      requests,
      budget: budget.snapshot(),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    globalThis.fetch = original;
  }
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
