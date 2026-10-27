import { createTool } from "@mastra/core/tools";
import { queryInputSchema } from "./contracts";
import { queryCatalog } from "./query";
import { startToolLog, type AssistantLogging } from "../../logging";

export function createQueryCatalogTool(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return createTool({
    id: "query_catalog",
    description:
      "Read the catalog and saved ingestion reports with one SQL query. Output is bounded; expensive SQL can block Studio.",
    inputSchema: queryInputSchema,
    execute: async (input, context) => {
      const call = startToolLog(logging, "query_catalog", context);
      try {
        const result = queryCatalog(catalogPath(), input, context?.abortSignal);
        return call.finish(
          result,
          result.ok
            ? {
                rowCount: result.rowCount,
                truncated: result.truncated,
              }
            : {},
        );
      } catch (error) {
        call.finish({ ok: false, error: "execution_failed" });
        throw error;
      }
    },
  });
}
