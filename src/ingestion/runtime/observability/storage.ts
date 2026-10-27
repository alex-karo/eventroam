import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";

import { sameFile } from "../../../db/file-identity";

export function observabilityDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
  protectedPaths: string[] = [],
): string {
  const path = resolve(
    cwd,
    env.CATALOG_OBSERVABILITY_DATABASE_PATH?.trim() ||
      "data/mastra-observability.duckdb",
  );
  const catalog = resolve(
    cwd,
    env.DATABASE_PATH?.trim() || "data/eventroam.sqlite",
  );
  const legacy = resolve(cwd, "data/mastra-traces.sqlite");
  const forbidden = [
    catalog,
    `${catalog}-wal`,
    `${catalog}-shm`,
    `${catalog}-journal`,
    legacy,
    ...(env.CATALOG_TRACE_DATABASE_PATH
      ? [resolve(cwd, env.CATALOG_TRACE_DATABASE_PATH)]
      : []),
    ...protectedPaths,
  ].map((p) => resolve(cwd, p));
  if (
    /\.sqlite(?:3)?(?:$|-)/i.test(path) ||
    forbidden.some(
      (file) => sameFile(path, file) || sameFile(`${path}.wal`, file),
    )
  ) {
    throw new Error(
      "Observability storage must be separate from catalog, historical and report files",
    );
  }
  return path;
}
export async function createObservabilityStore(
  env: NodeJS.ProcessEnv = process.env,
  protectedPaths: string[] = [],
) {
  const path = observabilityDatabasePath(env, process.cwd(), protectedPaths);
  await mkdir(dirname(path), { recursive: true });
  return new DuckDBStore({ id: "catalog-observability", path });
}
