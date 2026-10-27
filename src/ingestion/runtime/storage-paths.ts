import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

function canonicalPath(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  const parent = dirname(path);
  return parent === path
    ? path
    : resolve(canonicalPath(parent), basename(path));
}

export function filesAlias(a: string, b: string): boolean {
  if (canonicalPath(a) === canonicalPath(b)) {
    return true;
  }
  if (!existsSync(a) || !existsSync(b)) {
    return false;
  }
  const left = statSync(a),
    right = statSync(b);
  return left.dev === right.dev && left.ino === right.ino;
}

function sqliteFiles(path: string) {
  return [path, `${path}-wal`, `${path}-shm`, `${path}-journal`];
}

/** Check every diagnostic file before opening either diagnostic provider. */
export function diagnosticStoragePaths(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
  protectedPaths: string[] = [],
) {
  const workflow = resolve(
    cwd,
    env.CATALOG_WORKFLOW_DATABASE_PATH?.trim() ||
      "data/mastra-workflows.sqlite",
  );
  const observability = resolve(
    cwd,
    env.CATALOG_OBSERVABILITY_DATABASE_PATH?.trim() ||
      "data/mastra-observability.duckdb",
  );
  const protectedFiles = [
    ...sqliteFiles(
      resolve(cwd, env.DATABASE_PATH?.trim() || "data/eventroam.sqlite"),
    ),
    ...sqliteFiles(resolve(cwd, "data/mastra-traces.sqlite")),
    ...(env.CATALOG_TRACE_DATABASE_PATH
      ? sqliteFiles(resolve(cwd, env.CATALOG_TRACE_DATABASE_PATH))
      : []),
    ...protectedPaths.map((file) => resolve(cwd, file)),
  ];
  const workflowFiles = sqliteFiles(workflow);
  const observationFiles = [observability, `${observability}.wal`];
  const overlaps = (left: string[], right: string[]) =>
    left.some((a) => right.some((b) => filesAlias(a, b)));
  if (
    /\.sqlite(?:3)?(?:$|-)/i.test(observability) ||
    overlaps(workflowFiles, [...observationFiles, ...protectedFiles]) ||
    overlaps(observationFiles, protectedFiles)
  ) {
    throw new Error(
      "Diagnostic storage must be separate from catalog, historical and report files",
    );
  }
  return { workflow, observability };
}

export function workflowDatabasePath(
  env = process.env,
  cwd = process.cwd(),
  protectedPaths: string[] = [],
) {
  return diagnosticStoragePaths(env, cwd, protectedPaths).workflow;
}
