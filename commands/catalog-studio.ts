import { chatDatabasePath } from "../src/mastra/catalog-assistant/memory";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { diagnosticStoragePaths } from "../src/ingestion/runtime/storage-paths";
import { readDatabaseEnvironment } from "../src/db/env";

// Resolve before the CLI changes its working directory to .mastra/output.
const root = process.cwd();
const paths = diagnosticStoragePaths();
const child = spawn(
  process.execPath,
  [
    resolve(root, "node_modules/mastra/dist/index.js"),
    "dev",
    "--dir",
    resolve(root, "src/mastra"),
    "--root",
    root,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_PATH: resolve(root, readDatabaseEnvironment().DATABASE_PATH),
      CATALOG_OBSERVABILITY_DATABASE_PATH: paths.observability,
      CATALOG_WORKFLOW_DATABASE_PATH: paths.workflow,
      CATALOG_CHAT_DATABASE_PATH: chatDatabasePath(),
      CATALOG_ASSISTANT_SKILL_PATH: resolve(
        root,
        "src/mastra/catalog-assistant/skills/catalog-sql",
      ),
    },
  },
);
child.on("error", () => {
  process.stderr.write("Studio launch failed\n");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
