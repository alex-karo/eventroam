import Database from "better-sqlite3";
import type { DuckDBStore } from "@mastra/duckdb";
import { readDatabaseEnvironment } from "../db/env";
import { loadResearchConfig } from "../ingestion/runtime/config";
import { createCatalogIngestionWorkflow } from "../ingestion/workflow";

/** Inspection never invokes this resolver or opens the catalog. */
export function createStudioIngestionWorkflow(observabilityStore: DuckDBStore) {
  return createCatalogIngestionWorkflow(async () => {
    const config = loadResearchConfig();
    const client = new Database(readDatabaseEnvironment().DATABASE_PATH, {
      fileMustExist: true,
    });
    try {
      client.pragma("foreign_keys = ON");
      client.pragma("busy_timeout = 5000");
      // Probe the required current schema without creating or migrating it.
      client
        .prepare(
          "SELECT id, input_json, report_json FROM ingestion_runs LIMIT 0",
        )
        .all();
      client.prepare("SELECT id FROM events LIMIT 0").all();
      return {
        deps: { client, config, observabilityStore },
        close: () => client.close(),
      };
    } catch {
      client.close();
      throw new Error("Ingestion prerequisites unavailable");
    }
  });
}
