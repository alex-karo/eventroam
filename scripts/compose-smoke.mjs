import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "eventroam-compose-"));
const project = `eventroam-smoke-${randomUUID().slice(0, 8)}`;
const restoreVolume = `${project}-restore`;
let restoreVolumeCreated = false;
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
function docker(extra, capture = false) {
  return execFileSync("docker", extra, {
    cwd: root,
    env,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
}
const command = (extra, capture = false) =>
  docker([...args, ...extra], capture);
const worker = (...extra) =>
  command(
    ["run", "--rm", "--no-deps", "studio", "node", ...extra],
    true,
  ).trim();
const execStudio = (code) =>
  command(
    ["exec", "-T", "studio", "node", "--input-type=module", "-e", code],
    true,
  );

try {
  console.log(`Compose smoke project: ${project}`);
  command(["build"]);
  // Prepare the empty test catalog before starting the services.
  worker("commands/migrate.mjs");
  command(["up", "-d", "--wait", "--wait-timeout", "60", "web", "studio"]);
  execStudio(
    'const response = await fetch("http://127.0.0.1:4111/ingestion-queue"); if (!response.ok) throw new Error("Studio queue unavailable");',
  );
  const endpoint = "http://127.0.0.1:4111/api/workflows/catalog-ingestion";
  const runId = JSON.parse(
    execStudio(
      `const response = await fetch("${endpoint}/create-run", {method:"POST", headers:{"content-type":"application/json"}, body:"{}"}); if (!response.ok) throw new Error("Create failed"); console.log(JSON.stringify(await response.json()));`,
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
  execStudio(
    `import {existsSync, mkdirSync, utimesSync, writeFileSync} from "node:fs"; const response = await fetch("${endpoint}/runs/${encodeURIComponent(runId)}"); const run = await response.json(); if (!response.ok || run.runId !== ${JSON.stringify(runId)} || run.status !== "pending") throw new Error("Pending history did not survive replacement"); for (const path of ["/data/eventroam.sqlite", "/data/mastra-workflows.sqlite", "/data/mastra-observability.duckdb"]) if (!existsSync(path)) throw new Error("Missing storage file: " + path); const sources = "/data/ingestion-sources/smoke/sources"; mkdirSync(sources, {recursive: true}); writeFileSync(sources + "/s1.md", "saved page"); writeFileSync(sources + "/s1.evidence.json", "{}"); const old = new Date(Date.now() - 31 * 86400000); for (const name of ["s1.md", "s1.evidence.json"]) utimesSync(sources + "/" + name, old, old);`,
  );
  const studioContainer = command(
    ["ps", "--all", "--quiet", "studio"],
    true,
  ).trim();
  const studioImage = docker(
    ["inspect", "--format", "{{.Image}}", studioContainer],
    true,
  ).trim();
  docker(["volume", "create", restoreVolume], true);
  restoreVolumeCreated = true;
  env.EVENTROAM_BACKUP_IMAGE = studioImage;
  const backupOverride = join(directory, "backup.yaml");
  await writeFile(
    backupOverride,
    `
services:
  database:
    volumes: [restore:/restore]
  restic:
    network_mode: none
    volumes: [restore:/restore]
    environment:
      RESTIC_REPOSITORY: /restore/repository
      AWS_DEFAULT_REGION: test
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
volumes:
  data:
    name: ${project}_data
  restore:
    external: true
    name: ${restoreVolume}
`,
  );
  const backup = (service, extra, options = []) =>
    docker(
      [
        "compose",
        "--env-file",
        emptyEnv,
        "-p",
        project,
        "-f",
        join(root, "compose.backup.yaml"),
        "-f",
        backupOverride,
        "run",
        "--rm",
        "--no-deps",
        "-T",
        ...options,
        service,
        ...extra,
      ],
      true,
    );
  const database = (...extra) => backup("database", extra);
  const restic = (...extra) => backup("restic", extra);
  database("pause");
  command(["exec", "-T", "studio", "node", "commands/backup.mjs", "drain"]);
  execStudio(
    `const response = await fetch("${endpoint}/create-run", {method:"POST", headers:{"content-type":"application/json"}, body:"{}"}); if (response.status !== 503) throw new Error("Backup did not block new work");`,
  );
  command(["stop", "web", "studio"]);
  database("prepare");
  command(["start", "--wait", "--wait-timeout", "60", "web"]);
  if (
    docker(
      ["inspect", "-f", "{{.State.Running}}", studioContainer],
      true,
    ).trim() !== "false"
  ) {
    throw new Error("Starting the website also started Studio");
  }
  restic("init");
  restic(
    "backup",
    "--compression",
    "auto",
    "--tag",
    `image=${studioImage}`,
    "/data",
  );
  database("prune");
  restic("restore", "latest", "--target", "/restore", "--verify");
  restic("check");
  backup(
    "database",
    [
      "--input-type=module",
      "-e",
      `
        import assert from "node:assert/strict";
        import {existsSync, readFileSync, writeFileSync} from "node:fs";
        import {spawnSync} from "node:child_process";
        const restored = "/restore/data/mastra-chat.sqlite";
        const original = readFileSync(restored);
        assert.equal(existsSync("/data/ingestion-sources/smoke"), false, "Old source files or empty folders remain");
        const verify = () => spawnSync(process.execPath,
          ["commands/backup.mjs", "verify"], {encoding: "utf8"});
        writeFileSync(restored, Buffer.alloc(original.length));
        assert.notEqual(verify().status, 0, "Corrupt restored database passed");
        writeFileSync(restored, original);
        const result = verify();
        assert.equal(result.status, 0, result.stderr);
        assert.equal(readFileSync("/restore/data/ingestion-sources/smoke/sources/s1.md", "utf8"), "saved page");
        assert.equal(readFileSync("/restore/data/ingestion-sources/smoke/sources/s1.evidence.json", "utf8"), "{}");
      `,
    ],
    ["--entrypoint", "node"],
  );
  database("resume");
  command(["up", "-d", "--wait", "--wait-timeout", "60", "web", "studio"]);
  console.log(
    "Compose smoke passed: health, saved history, backup drain, preparation, and restore verification.",
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
    try {
      if (restoreVolumeCreated) {
        docker(["volume", "rm", restoreVolume]);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
