import Database from "better-sqlite3";
import { Mastra } from "@mastra/core/mastra";
import { createCatalogIngestionWorkflow } from "../../../ingestion/workflow";
import { DEFAULT_RESEARCH_LIMITS } from "../../../ingestion/runtime/budget";
import { createObservabilityStore } from "../../../ingestion/runtime/observability/storage";
import { ingestionExecutionGuard } from "../../../mastra/ingestion-guard";

export const OFFLINE_SENTINEL = "PRIVATE_STUDIO_FIXTURE_SENTINEL";
const eventId = "00000000-0000-4000-8000-000000000001";
const sourceUrl = "https://example.org/studio-fixture";
const scenario = process.env.STUDIO_FIXTURE_SCENARIO ?? "success";
const observabilityStore = await fixtureStore();

if (scenario.startsWith("agent")) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (!String(input).includes("openrouter.ai")) {
      return originalFetch(input, init);
    }
    if (scenario === "agent-cancel") {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 15_000);
        const signal = init?.signal;
        if (signal?.aborted) {
          clearTimeout(timer);
          reject(signal.reason);
        } else {
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(signal.reason);
            },
            { once: true },
          );
        }
      });
    }
    const body = JSON.parse(String(init?.body)) as {
      response_format?: { json_schema?: { schema?: Record<string, unknown> } };
    };
    const candidate = {
      status: "success",
      data: {
        eventId,
        eventName: "Studio Fixture Festival",
        sources: [{ url: sourceUrl, information: OFFLINE_SENTINEL }],
        links: { socials: {} },
        editions: [
          {
            key: "2027",
            year: { value: 2027, reason: OFFLINE_SENTINEL },
            dates: {
              value: {
                startsOn: "2027-07-01",
                endsOn: "2027-07-03",
                state: "confirmed",
              },
              reason: OFFLINE_SENTINEL,
            },
            countryCode: { value: "PT", reason: OFFLINE_SENTINEL },
            locality: { value: "Lisbon", reason: OFFLINE_SENTINEL },
            links: {},
          },
        ],
      },
      errors: [],
      unresolved: [],
    };
    return Response.json({
      id: "offline-response",
      object: "chat.completion",
      created: 1,
      model: "fixture/offline-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(
              wireFixture(candidate, body.response_format?.json_schema?.schema),
            ),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        cost: 0,
      },
    });
  };
}

export const mastra = new Mastra({
  workflows: {
    "catalog-ingestion": createCatalogIngestionWorkflow(async (input) => {
      const path = process.env.DATABASE_PATH;
      if (!path) {
        throw new Error("Fixture catalog unavailable");
      }
      const client = new Database(path, { fileMustExist: true });
      return {
        deps: {
          client,
          observabilityStore,
          config: {
            apiKey: OFFLINE_SENTINEL,
            model: "fixture/offline-model",
            limits: { ...DEFAULT_RESEARCH_LIMITS, durationMs: 30_000 },
          },
          todayUtc: "2026-10-10",
          readSource: async (url, { budget }) => {
            budget.consumePage();
            return {
              attemptedUrl: url,
              finalUrl: url,
              retrievedAt: "2026-10-10T12:00:00Z",
              method: "http" as const,
              outcome: "ok" as const,
              completeness: "full" as const,
              markdown: `${OFFLINE_SENTINEL} Fixture festival starts July 1, 2027.`,
              links: [],
            };
          },
          discoverSources: async (query, { budget }) => {
            budget.consumeSearch();
            return {
              query,
              candidates: [],
              retrievedAt: "2026-10-10T12:00:00Z",
              inputTokens: 0,
              outputTokens: 0,
              modelCostUsd: null,
              searchCostUsd: 0,
            };
          },
          ...(scenario.startsWith("agent")
            ? {}
            : {
                generateCandidate: async () => {
                  if (scenario === "cancel") {
                    await new Promise((resolve) => setTimeout(resolve, 5_000));
                  }
                  if (scenario === "failure") {
                    return {
                      status: "failed",
                      data: null,
                      errors: [
                        {
                          code: "source_unavailable",
                          message: OFFLINE_SENTINEL,
                          url: null,
                          editionKey: null,
                          field: null,
                        },
                      ],
                      unresolved: [],
                    };
                  }
                  return {
                    status: scenario === "partial" ? "partial" : "success",
                    data: {
                      ...(input.mode === "add" ? {} : { eventId }),
                      eventName: "Studio Fixture Festival",
                      sources: [
                        { url: sourceUrl, information: OFFLINE_SENTINEL },
                      ],
                      links: { socials: {} },
                      editions: [
                        {
                          key: "2027",
                          year: { value: 2027, reason: OFFLINE_SENTINEL },
                          dates: {
                            value: {
                              startsOn: "2027-07-01",
                              endsOn: "2027-07-03",
                              state: "confirmed",
                            },
                            reason: OFFLINE_SENTINEL,
                          },
                          countryCode: {
                            value: "PT",
                            reason: OFFLINE_SENTINEL,
                          },
                          locality: {
                            value: "Lisbon",
                            reason: OFFLINE_SENTINEL,
                          },
                          links: {},
                        },
                      ],
                    },
                    errors: [],
                    unresolved:
                      scenario === "partial"
                        ? [{ message: "Exact venue unknown", field: "venue" }]
                        : [],
                  };
                },
              }),
        },
        close: () => client.close(),
      };
    }),
  },
  storage: observabilityStore,
  logger: false,
  loggerOptions: { export: false },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.STUDIO_FIXTURE_PORT ?? 4111),
    middleware: [ingestionExecutionGuard],
  },
});

async function fixtureStore() {
  const store = await createObservabilityStore();
  await store.init();
  return store;
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
