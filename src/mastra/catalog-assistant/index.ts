import { fileURLToPath } from "node:url";
import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import type { Memory } from "@mastra/memory";
import { readDatabaseEnvironment } from "../../db/env";
import { loadResearchModelConfig } from "../../ingestion/runtime/config";
import {
  createResearchModel,
  researchProviderOptions,
} from "../../ingestion/runtime/openrouter";
import { ASSISTANT_INSTRUCTIONS } from "./prompt";
import { assistantExecutionContext } from "./execution-context";
import { createAssistantTools } from "./tools";
import type { AssistantLogging } from "./logging";

/** Model credentials and the catalog are resolved only when execution needs them. */
export function createCatalogAssistant(
  memory: Memory,
  model?: MastraModelConfig,
  logging?: AssistantLogging,
) {
  return new Agent({
    id: "catalog-assistant",
    name: "Catalog assistant",
    instructions: ASSISTANT_INSTRUCTIONS,
    tools: createAssistantTools(
      () => readDatabaseEnvironment().DATABASE_PATH,
      logging,
    ),
    skills: [
      process.env.CATALOG_ASSISTANT_SKILL_PATH ??
        fileURLToPath(new URL("./skills/catalog-sql", import.meta.url)),
    ],
    model:
      model ??
      (() =>
        createResearchModel(
          loadResearchModelConfig({
            ...process.env,
            OPENROUTER_API_KEY:
              process.env.OPENROUTER_API_KEY?.trim() || "inspection-only",
          }),
        )),
    memory,
    inputProcessors: [assistantExecutionContext],
    errorProcessorDefaults: false,
    defaultOptions: {
      maxSteps: 12,
      prepareStep: ({ model, providerOptions }) => {
        if (model.provider !== "openrouter") {
          return;
        }
        return {
          providerOptions: {
            ...providerOptions,
            openrouter: {
              ...researchProviderOptions(loadResearchModelConfig()).openrouter,
              ...providerOptions?.openrouter,
            },
          },
        };
      },
    },
  });
}
