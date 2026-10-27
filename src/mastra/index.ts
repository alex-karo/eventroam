import { Mastra } from "@mastra/core/mastra";
import { createStudioStorage } from "../ingestion/evals/storage";
import { createStudioIngestionWorkflow } from "./ingestion";
import { ingestionExecutionGuard } from "./ingestion-guard";

const { storage, observations } = await studioStore();

export const mastra = new Mastra({
  workflows: {
    "catalog-ingestion": createStudioIngestionWorkflow(observations),
  },
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
    const store = await createStudioStorage();
    await store.storage.init();
    return store;
  } catch {
    process.stderr.write(
      "Studio cannot open local storage. Close other Studio/research processes using this file, then start Studio again.\n",
    );
    throw new Error("studio_storage_unavailable");
  }
}
