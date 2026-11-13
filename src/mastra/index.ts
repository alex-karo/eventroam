import { createCatalogAssistant } from "./catalog-assistant";
import {
  chatDatabasePath,
  createChatMemory,
  StudioMastra as Mastra,
} from "./catalog-assistant/memory";
import { createStudioStorage } from "../ingestion/evals/storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";
import { createStudioJobs } from "./jobs";
import { createApplicationLogger } from "../ingestion/runtime/logging";
import { createAssistantLogging } from "./catalog-assistant/logging";
import { catalogEditApproval } from "./catalog-assistant/edit-approval";
import { createMaintenanceControl } from "./maintenance";

const chatPath = chatDatabasePath();
const { workflow, storage } = await studioResources();
const chat = await createChatMemory(chatPath).catch(async () => {
  await storage.close();
  throw new Error("Studio chat storage unavailable");
});
const logging = createAssistantLogging();
const assistant = createCatalogAssistant(chat.memory, undefined, logging);
const maintenance = createMaintenanceControl();
const jobs = createStudioJobs(
  workflow,
  logging && createApplicationLogger(logging),
  maintenance,
);

export const mastra = new Mastra(
  {
    agents: {
      "catalog-assistant": assistant,
    },
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: logging?.native ?? false,
    observability: logging?.observability,
    server: {
      host: "127.0.0.1",
      port: 4111,
      drainTimeout: 55_000,
    },
  },
  chat,
  jobs,
);

// The CLI reads the static server options before it starts the application.
mastra.setServer({
  ...mastra.getServer(),
  apiRoutes: [jobs.route],
  middleware: [
    maintenance.middleware,
    catalogEditApproval(assistant),
    ingestionExecutionGuard(workflow.historyControl, storage),
  ],
});

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
