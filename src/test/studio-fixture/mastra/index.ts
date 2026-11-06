import { catalogEditApproval } from "../../../mastra/catalog-assistant/edit-approval";
import { createCatalogResearcher } from "../../../mastra/catalog-researcher";
import { fixtureRoleForProvider } from "../../ingestion-provider";
import { fixtureDescriptionRole, fixtureTargets, set } from "../../ingestion";
import Database from "better-sqlite3";
import { createCatalogAssistant } from "../../../mastra/catalog-assistant";
import { createAssistantLogging } from "../../../mastra/catalog-assistant/logging";
import {
  createChatMemory,
  StudioMastra,
} from "../../../mastra/catalog-assistant/memory";
import { createAssistantFixtureModel } from "../../assistant-model";
import { createStudioIngestionWorkflow } from "../../../mastra/ingestion";
import { createStudioJobs } from "../../../mastra/jobs";
import { createApplicationLogger } from "../../../ingestion/runtime/logging";
import { DEFAULT_RESEARCH_LIMITS } from "../../../ingestion/runtime/budget";
import { createObservabilityStore } from "../../../ingestion/runtime/observability/storage";
import { diagnosticStoragePaths } from "../../../ingestion/runtime/storage-paths";
import { createWorkflowStorage } from "../../../ingestion/runtime/workflow-storage";
import { ingestionExecutionGuard } from "../../../mastra/ingestion-guard";

export const OFFLINE_SENTINEL = "PRIVATE_STUDIO_FIXTURE_SENTINEL";
const eventId = "00000000-0000-4000-8000-000000000001";
const scenario = process.env.STUDIO_FIXTURE_SCENARIO ?? "success";

const general = {
  ...fixtureTargets(eventId),
  observedEventName: "Studio Fixture Festival",
  reason: OFFLINE_SENTINEL,
};
const classification = fixtureDescriptionRole({
  description: set(
    "Live music takes place outdoors. The programme includes workshops. Visitors can join group activities.",
  ),
  shortDescription: set("An outdoor music festival with workshops."),
});

// Keep the real agent/provider adapter for cancellation and tracing; mock only HTTP.
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const address = input instanceof Request ? input.url : input;
    const url = new URL(address);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return originalFetch(input, init);
    }
    if (url.hostname !== "openrouter.ai") {
      throw new Error("Unexpected external request in Studio fixture");
    }
    if (scenario === "cancel") {
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
      plugins?: unknown[];
      response_format?: { json_schema?: { schema?: Record<string, unknown> } };
    };
    if (body.plugins) {
      return Response.json({
        choices: [
          {
            message: {
              annotations: [
                {
                  type: "url_citation",
                  url_citation: {
                    url: "https://alpha.test/",
                    title: "Alpha Festival",
                  },
                },
                {
                  type: "url_citation",
                  url_citation: {
                    url: "https://beta.test/",
                    title: "Beta Festival",
                  },
                },
              ],
            },
          },
        ],
      });
    }
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
              await fixtureRoleForProvider(body, { general, classification }),
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

export async function createFixtureMastra() {
  const logging = createAssistantLogging();
  const observabilityStore = await fixtureStore();
  const chat = await createChatMemory(process.env.CATALOG_CHAT_DATABASE_PATH);
  const workflow = createStudioIngestionWorkflow(
    observabilityStore,
    async () => {
      if (process.env.STUDIO_FIXTURE_INSPECTION_ONLY === "true") {
        throw new Error("Inspection must not resolve catalog dependencies");
      }
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
            apiKey: "fixture-api-key",
            model: "fixture/offline-model",
            limits: { ...DEFAULT_RESEARCH_LIMITS, durationMs: 30_000 },
          },
          todayUtc: "2026-10-10",
          readPage: async (url, { budget }) => {
            budget.consumePage();
            return {
              attemptedUrl: url,
              finalUrl: url,
              retrievedAt: "2026-10-10T12:00:00Z",
              method: "http" as const,
              status: "ok" as const,
              markdown:
                "PRIVATE_STUDIO_PAGE_BODY Fixture festival starts July 1, 2027.",
            };
          },
          searchWeb: async (query, { budget }) => {
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
        },
        close: () => client.close(),
      };
    },
  );
  const storage = createWorkflowStorage({
    path: diagnosticStoragePaths().workflow,
    observability: observabilityStore,
    onFailure: workflow.historyControl.recoverHistory,
  });
  await storage.init();
  const jobs = createStudioJobs(
    workflow,
    logging && createApplicationLogger(logging),
  );
  const assistant = createCatalogAssistant(
    chat.memory,
    createAssistantFixtureModel(),
    logging,
  );
  return new StudioMastra(
    {
      workflows: { "catalog-ingestion": workflow },
      agents: {
        "catalog-researcher": createCatalogResearcher(
          chat.memory,
          createAssistantFixtureModel(),
          logging,
        ),
        "catalog-assistant": assistant,
      },
      storage,
      logger: logging?.native ?? false,
      observability: logging?.observability,
      server: {
        host: "127.0.0.1",
        port: Number(process.env.STUDIO_FIXTURE_PORT ?? 4111),
        apiRoutes: [jobs.route],
        middleware: [
          catalogEditApproval(assistant),
          ingestionExecutionGuard(workflow.historyControl, storage),
        ],
      },
    },
    chat,
    jobs,
  );
}

async function fixtureStore() {
  const store = await createObservabilityStore();
  await store.init();
  return store;
}
