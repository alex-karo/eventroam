import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LibSQLStore } from "@mastra/libsql";
import { MastraCompositeStore } from "@mastra/core/storage";
import { createObservabilityStore } from "../runtime/observability/storage";
import { diagnosticStoragePaths, filesAlias } from "../runtime/storage-paths";
import { createWorkflowStorage } from "../runtime/workflow-storage";

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
  const { observability: observations } = diagnosticStoragePaths(env, cwd, [
    path,
    `${path}-wal`,
    `${path}-shm`,
    `${path}-journal`,
  ]);
  const chat = resolve(
    cwd,
    env.CATALOG_CHAT_DATABASE_PATH?.trim() || "data/mastra-chat.sqlite",
  );
  if (
    [catalog, observations, chat].some((file) =>
      ["", "-wal", "-shm", "-journal", ".wal"].some((suffix) =>
        filesAlias(path, `${file}${suffix}`),
      ),
    )
  ) {
    throw new Error(
      "Eval storage must be separate from catalog, observability, workflow and chat storage",
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
  const workflows = createWorkflowStorage({
    path: diagnosticStoragePaths(env).workflow,
    observability: observations,
  });
  class StudioStore extends MastraCompositeStore {
    override async close() {
      try {
        await super.close();
      } finally {
        try {
          await workflows.close();
        } finally {
          await evals.close();
        }
      }
    }
  }
  const storage = new StudioStore({
    id: "catalog-studio",
    default: workflows,
    domains: {
      datasets: await evals.getStore("datasets"),
      experiments: await evals.getStore("experiments"),
      scores: await evals.getStore("scores"),
    },
  });
  return { storage, observations, workflows, evals };
}
