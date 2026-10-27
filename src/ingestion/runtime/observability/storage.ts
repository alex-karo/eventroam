import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { diagnosticStoragePaths } from "../storage-paths";

export function observabilityDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
  protectedPaths: string[] = [],
): string {
  return diagnosticStoragePaths(env, cwd, protectedPaths).observability;
}
export async function createObservabilityStore(
  env: NodeJS.ProcessEnv = process.env,
  protectedPaths: string[] = [],
) {
  const path = observabilityDatabasePath(env, process.cwd(), protectedPaths);
  await mkdir(dirname(path), { recursive: true });
  return new DuckDBStore({ id: "catalog-observability", path });
}
