import { Mastra } from "@mastra/core/mastra";
import { createObservabilityStore } from "../ingestion/runtime/observability/storage";
import { diagnosticStoragePaths } from "../ingestion/runtime/storage-paths";
import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";

const { workflow, storage } = await studioResources();

async function studioResources() {
  let observability:
    Awaited<ReturnType<typeof createObservabilityStore>> | undefined;
  let storage: ReturnType<typeof createWorkflowStorage> | undefined;
  try {
    // Check both providers before either can change a file.
    diagnosticStoragePaths();
    observability = await createObservabilityStore();
    const workflow = createStudioIngestionWorkflow(observability);
    storage = createWorkflowStorage({
      observability,
      onFailure: workflow.historyControl.recoverHistory,
    });
    await storage.init();
    return { workflow, storage };
  } catch {
    try {
      if (storage) {
        await storage.close();
      } else {
        await observability?.close();
      }
    } catch {
      // Keep startup errors bounded even if provider cleanup fails.
    }
    process.stderr.write(
      "Studio cannot open diagnostic storage. Check paths and close other processes using its files.\n",
    );
    throw new Error("studio_storage_unavailable");
  }
}

export const mastra = new Mastra({
  workflows: { "catalog-ingestion": workflow },
  storage,
  logger: false,
  loggerOptions: { export: false },
  server: {
    host: "127.0.0.1",
    port: 4111,
    middleware: [ingestionExecutionGuard(workflow.historyControl, storage)],
  },
});
