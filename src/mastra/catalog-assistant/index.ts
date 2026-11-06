import { fileURLToPath } from "node:url";
import type { ToolsInput } from "@mastra/core/agent";
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
  return createCatalogChatAgent(
    memory,
    {
      id: "catalog-assistant",
      name: "Catalog assistant",
      instructions: ASSISTANT_INSTRUCTIONS,
      tools: {
        ...createAssistantTools(
          () => readDatabaseEnvironment().DATABASE_PATH,
          logging,
        ),
        web_search: {
          type: "provider-defined",
          id: "openrouter.web_search",
          name: "web_search",
          args: {},
        },
      },
    },
    model,
  );
}

export function createCatalogChatAgent(
  memory: Memory,
  options: {
    id: string;
    name: string;
    instructions: string;
    tools: ToolsInput;
  },
  model?: MastraModelConfig,
) {
  return new Agent({
    ...options,
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
      prepareStep: ({ activeTools, model, providerOptions, tools }) => {
        if (model.provider !== "openrouter") {
          if (tools?.web_search) {
            return {
              activeTools: (activeTools ?? Object.keys(tools)).filter(
                (name) => name !== "web_search",
              ),
            };
          }
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
