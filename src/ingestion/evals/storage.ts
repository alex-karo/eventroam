import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LibSQLStore } from "@mastra/libsql";
import { MastraCompositeStore } from "@mastra/core/storage";
import {
  createObservabilityStore,
  pathsAlias,
} from "../runtime/observability/storage";

export function evalDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
) {
  const path = resolve(
    cwd,
    env.CATALOG_EVAL_DATABASE_PATH?.trim() || "data/mastra-evals.sqlite",
  );
  const catalog = resolve(
    cwd,
    env.DATABASE_PATH?.trim() || "data/eventroam.sqlite",
  );
  const observations = resolve(
    cwd,
    env.CATALOG_OBSERVABILITY_DATABASE_PATH?.trim() ||
      "data/mastra-observability.duckdb",
  );
  if (
    [catalog, observations].some((file) =>
      ["", "-wal", "-shm", "-journal", ".wal"].some((suffix) =>
        pathsAlias(path, `${file}${suffix}`),
      ),
    )
  ) {
    throw new Error(
      "Eval storage must be separate from the catalog and observability storage",
    );
  }
  return path;
}

export async function createEvalStore(env: NodeJS.ProcessEnv = process.env) {
  const path = evalDatabasePath(env);
  await mkdir(dirname(path), { recursive: true });
  return new LibSQLStore({ id: "catalog-evals", url: `file:${path}` });
}

export async function createStudioStorage(
  env: NodeJS.ProcessEnv = process.env,
) {
  const evals = await createEvalStore(env);
  const observations = await createObservabilityStore(env, [
    evalDatabasePath(env),
  ]);
  class StudioStore extends MastraCompositeStore {
    override async close() {
      try {
        await super.close();
      } finally {
        await evals.close();
      }
    }
  }
  const storage = new StudioStore({
    id: "catalog-studio",
    default: observations,
    domains: {
      datasets: await evals.getStore("datasets"),
      experiments: await evals.getStore("experiments"),
      scores: await evals.getStore("scores"),
    },
  });
  return { storage, observations, evals };
}
