import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as store from "./db-transfer-store.mjs";

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function remoteScript(direction, worker, withMastra) {
  const code = `${worker}\nmain(process.argv.slice(1)).catch(error => { console.error(error.message); process.exitCode = 1; });`;
  return `set -euo pipefail
find_service() {
  local ids
  ids=$(docker ps -aq --filter label=com.docker.compose.project=eventroam --filter label=com.docker.compose.service="$1" --filter label=com.docker.compose.oneoff=False)
  [[ "$ids" =~ ^[a-f0-9]{12,64}$ ]] || { echo "Expected one eventroam $1 container." >&2; exit 1; }
  echo "$ids"
}
web=$(find_service web)
studio=$(find_service studio)
volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$studio")
[[ "$volume" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || { echo 'Studio needs a named data volume at /data.' >&2; exit 1; }
image=$(docker inspect -f '{{.Image}}' "$studio")
running=()
for id in "$web" "$studio"; do
  if [[ $(docker inspect -f '{{.State.Running}}' "$id") == true ]]; then running+=("$id"); fi
done
restore_services() {
  local result=$?
  trap - EXIT
  if [[ ${shellQuote(direction)} == push && $result != 0 ]]; then
    echo 'Push failed. Automatic restart was skipped. Inspect the database and its backup before restart.' >&2
  elif (( \${#running[@]} )); then
    docker start "\${running[@]}" >&2 || result=1
  fi
  exit "$result"
}
trap restore_services EXIT
if (( \${#running[@]} )); then docker stop -t 120 "\${running[@]}" >&2; fi
docker run --rm -i --network none --user 1000:1000 --mount "type=volume,src=$volume,dst=/data" --entrypoint node "$image" --input-type=module -e ${shellQuote(code)} ${shellQuote(direction)} ${shellQuote(withMastra ? "all" : "catalog")}
`;
}

function options(args) {
  const [direction, ...flags] = args;
  if (!["pull", "push"].includes(direction)) {
    throw new Error("Expected pull or push");
  }
  const allowed = new Set(["--local-stopped", "--with-mastra", "--help"]);
  for (const flag of flags) {
    if (!allowed.has(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }
  }
  return {
    direction,
    withMastra: flags.includes("--with-mastra"),
    help: flags.includes("--help"),
    stopped: flags.includes("--local-stopped"),
  };
}

async function run(args, env = process.env) {
  const { direction, help, stopped, withMastra } = options(args);
  if (help) {
    console.log(`Usage: pnpm run db:${direction} --local-stopped [--with-mastra]
Stop local web, Studio, and catalog commands first.
Transfers the catalog. Add --with-mastra for workflow history, chats, and diagnostics.
Each target backup is kept in its adjacent backups directory. All selected source files must exist.
DATABASE_PATH selects the local file (default ./data/eventroam.sqlite).
Set DB_SSH_HOST in .env to select the server. There is no default.
Do not deploy or start other database users during transfer.`);
    return;
  }
  if (!stopped) {
    throw new Error("Stop all local database users, then pass --local-stopped");
  }
  const host = env.DB_SSH_HOST?.trim();
  if (!host) {
    throw new Error("Set DB_SSH_HOST in .env before transfer");
  }
  if (!/^[a-zA-Z0-9_@.:-]+$/.test(host) || host.startsWith("-")) {
    throw new Error("DB_SSH_HOST must be an SSH host or user@host");
  }
  const files = store.filesFor(env, withMastra);
  mkdirSync(dirname(files[0].path), { recursive: true });
  const directory = mkdtempSync(
    resolve(dirname(files[0].path), ".db-transfer-"),
  );
  const archive = resolve(directory, "transfer.tar");
  let fd;
  try {
    fd = openSync(archive, "wx+", 0o600);
    if (direction === "push") {
      await store.createBundle(files, directory, fd);
      closeSync(fd);
      fd = openSync(archive, "r");
    }
    const worker = readFileSync(
      new URL("./db-transfer-store.mjs", import.meta.url),
      "utf8",
    );
    console.log(
      `${direction === "pull" ? "Download from" : "Upload to"} ${host}: ${files.map((file) => file.name).join(", ")}`,
    );
    const script = remoteScript(direction, worker, withMastra);
    const child = spawnSync(
      "ssh",
      ["-T", "--", host, `bash -c ${shellQuote(script)}`],
      {
        stdio:
          direction === "pull"
            ? ["ignore", fd, "inherit"]
            : [fd, "inherit", "inherit"],
      },
    );
    closeSync(fd);
    fd = undefined;
    if (child.error) {
      throw child.error;
    }
    if (child.status !== 0) {
      throw new Error(`SSH transfer failed (${child.signal ?? child.status})`);
    }
    if (direction === "pull") {
      await store.installBundle(archive, files, directory);
    }
    console.log(`Database ${direction} complete.`);
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
