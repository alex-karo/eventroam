import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
  const evalFiles = [path, `${path}-wal`, `${path}-shm`, `${path}-journal`];
  const { observability: observations } = diagnosticStoragePaths(
    env,
    cwd,
    evalFiles,
  );
  const chat = resolve(
    cwd,
    env.CATALOG_CHAT_DATABASE_PATH?.trim() || "data/mastra-chat.sqlite",
  );
  if (
    [catalog, observations, chat].some((file) =>
      ["", "-wal", "-shm", "-journal", ".wal"].some((suffix) =>
        evalFiles.some((evalFile) => filesAlias(evalFile, `${file}${suffix}`)),
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
  return new LibSQLStore({
    id: "catalog-evals",
    url: pathToFileURL(path).href,
  });
}

export async function createStudioStorage(
  env: NodeJS.ProcessEnv = process.env,
) {
  const evals = await createEvalStore(env);
  let diagnostics: { close(): Promise<void> } | undefined;
  try {
    const observations = await createObservabilityStore(env, [
      evalDatabasePath(env),
    ]);
    diagnostics = observations;
    const workflows = createWorkflowStorage({
      path: diagnosticStoragePaths(env).workflow,
      observability: observations,
    });
    // Workflow storage owns observability after its construction.
    diagnostics = workflows;
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
  } catch (error) {
    await Promise.allSettled([diagnostics?.close(), evals.close()]);
    throw error;
  }
}
