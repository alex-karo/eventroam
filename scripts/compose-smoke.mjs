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
function command(extra) {
  execFileSync("docker", [...args, ...extra], {
    cwd: root,
    env,
    stdio: "inherit",
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
  console.log("Compose smoke passed: startup and health.");
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
