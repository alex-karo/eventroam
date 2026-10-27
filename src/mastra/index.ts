import { createCatalogAssistant } from "./catalog-assistant";
import {
  chatDatabasePath,
  createChatMemory,
  StudioMastra as Mastra,
} from "./catalog-assistant/memory";
import { createObservabilityStore } from "../ingestion/runtime/observability/storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";
import { createAssistantLogging } from "./catalog-assistant/logging";

const chatPath = chatDatabasePath();
const storage = await studioStore();
const chat = await createChatMemory(chatPath).catch(async () => {
  await storage.close();
  throw new Error("Studio chat storage unavailable");
});
const workflow = createStudioIngestionWorkflow(storage);
const logging = createAssistantLogging();

export const mastra = new Mastra(
  {
    agents: {
      "catalog-assistant": createCatalogAssistant(
        workflow,
        chat.memory,
        undefined,
        logging,
      ),
    },
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: logging?.sdk ?? false,
    observability: logging?.observability,
    loggerOptions: { export: false },
    server: {
      host: "127.0.0.1",
      port: 4111,
      middleware: [ingestionExecutionGuard],
    },
  },
  chat,
);

async function studioStore() {
  try {
    const store = await createObservabilityStore();
    await store.init();
    return store;
  } catch {
    process.stderr.write(
      "Studio cannot open observability storage. Close other Studio/research processes using this file, then start Studio again.\n",
    );
    throw new Error("studio_storage_unavailable");
  }
}
