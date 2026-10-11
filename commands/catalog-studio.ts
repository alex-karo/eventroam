import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { observabilityDatabasePath } from "../src/ingestion/runtime/observability/storage";

// Resolve before the CLI changes its working directory to .mastra/output.
const root = process.cwd();
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
      CATALOG_OBSERVABILITY_DATABASE_PATH: observabilityDatabasePath(),
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
