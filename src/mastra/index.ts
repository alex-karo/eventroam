import { Mastra } from "@mastra/core/mastra";
import { createObservabilityStore } from "../ingestion/runtime/observability/storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";

const storage = await studioStore();

export const mastra = new Mastra({
  workflows: { "catalog-ingestion": createStudioIngestionWorkflow(storage) },
  storage,
  logger: false,
  loggerOptions: { export: false },
  server: {
    host: "127.0.0.1",
    port: 4111,
    middleware: [ingestionExecutionGuard],
  },
});

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
