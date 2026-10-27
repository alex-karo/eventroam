import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "eventroam-compose-"));
const project = `eventroam-smoke-${randomUUID().slice(0, 8)}`;
const env = { ...process.env };
// Do not pass owner deployment inputs to disposable checks.
for (const key of Object.keys(env)) {
  if (key.startsWith("EVENTROAM_")) {
    delete env[key];
  }
}
// Disable automatic .env loading by Compose.
const emptyEnv = join(directory, "empty.env");
await writeFile(emptyEnv, "");
const args = [
  "compose",
  "--env-file",
  emptyEnv,
  "--project-directory",
  root,
  "-p",
  project,
  "-f",
  join(root, "compose.yaml"),
];
function command(extra, capture = false) {
  return execFileSync("docker", [...args, ...extra], {
    cwd: root,
    env,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
}

try {
  console.log(`Compose smoke project: ${project}`);
  command(["build"]);
  // Prepare the empty test catalog before starting either service.
  command([
    "run",
    "--rm",
    "--no-deps",
    "studio",
    "node",
    "commands/migrate.mjs",
  ]);
  command(["up", "-d", "--wait", "--wait-timeout", "60"]);
  const endpoint = "http://127.0.0.1:4111/api/workflows/catalog-ingestion";
  const runId = JSON.parse(
    command(
      [
        "exec",
        "-T",
        "studio",
        "node",
        "--input-type=module",
        "-e",
        `const response = await fetch("${endpoint}/create-run", {method:"POST", headers:{"content-type":"application/json"}, body:"{}"}); if (!response.ok) throw new Error("Create failed"); console.log(JSON.stringify(await response.json()));`,
      ],
      true,
    ),
  ).runId;
  if (!runId) {
    throw new Error("Pending history ID is missing");
  }
  command([
    "up",
    "-d",
    "--force-recreate",
    "--no-deps",
    "--wait",
    "--wait-timeout",
    "60",
    "studio",
  ]);
  command([
    "exec",
    "-T",
    "studio",
    "node",
    "--input-type=module",
    "-e",
    `import {existsSync} from "node:fs"; const response = await fetch("${endpoint}/runs/${encodeURIComponent(runId)}"); const run = await response.json(); if (!response.ok || run.runId !== ${JSON.stringify(runId)} || run.status !== "pending") throw new Error("Pending history did not survive replacement"); for (const path of ["/data/eventroam.sqlite", "/data/mastra-workflows.sqlite", "/data/mastra-observability.duckdb"]) if (!existsSync(path)) throw new Error("Missing storage file: " + path);`,
  ]);
  console.log(
    "Compose smoke passed: health and saved history after replacement.",
  );
} catch (error) {
  try {
    command(["logs", "--no-color", "--tail", "80"]);
  } catch {
    // Keep the original failure if logs are unavailable.
  }
  throw error;
} finally {
  try {
    // Only this random test project owns this volume.
    command(["down", "--volumes", "--remove-orphans"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
