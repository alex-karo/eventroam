import { createCatalogAssistant } from "./catalog-assistant";
import {
  chatDatabasePath,
  createChatMemory,
  StudioMastra as Mastra,
} from "./catalog-assistant/memory";
import { createStudioStorage } from "../ingestion/evals/storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";
import { createAssistantLogging } from "./catalog-assistant/logging";

const chatPath = chatDatabasePath();
const { workflow, storage } = await studioResources();
const chat = await createChatMemory(chatPath).catch(async () => {
  await storage.close();
  throw new Error("Studio chat storage unavailable");
});
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
      middleware: [ingestionExecutionGuard(workflow.historyControl, storage)],
    },
  },
  chat,
);

async function studioResources() {
  let storage:
    Awaited<ReturnType<typeof createStudioStorage>>["storage"] | undefined;
  try {
    const stores = await createStudioStorage();
    storage = stores.storage;
    const workflow = createStudioIngestionWorkflow(stores.observations);
    stores.workflows.setFailureHandler(workflow.historyControl.recoverHistory);
    await storage.init();
    return { workflow, storage };
  } catch {
    try {
      await storage?.close();
    } catch {
      // Keep startup errors bounded even if provider cleanup fails.
    }
    process.stderr.write(
      "Studio cannot open diagnostic storage. Check paths and close other processes using its files.\n",
    );
    throw new Error("studio_storage_unavailable");
  }
}
