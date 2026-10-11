import { existsSync, realpathSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";

function canonicalPath(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  const parent = dirname(path);
  return parent === path
    ? path
    : resolve(canonicalPath(parent), basename(path));
}

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
  const alias = (a: string, b: string) => {
    if (canonicalPath(a) === canonicalPath(b)) {
      return true;
    }
    if (!existsSync(a) || !existsSync(b)) {
      return false;
    }
    const left = statSync(a),
      right = statSync(b);
    return left.dev === right.dev && left.ino === right.ino;
  };
  if (
    /\.sqlite(?:3)?(?:$|-)/i.test(path) ||
    forbidden.some((file) => alias(path, file) || alias(`${path}.wal`, file))
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
