import { Mastra } from "@mastra/core/mastra";
import { createTraceStore } from "../ingestion/runtime/tracing";

// Inspection only: no model credentials, catalog connection, agents or workflows.
export const mastra = new Mastra({
  storage: await createTraceStore(),
  logger: false,
  server: { host: "127.0.0.1", port: 4111 },
});
