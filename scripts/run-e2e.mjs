import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// The database path is set for every child, so .env and the caller's
// DATABASE_PATH cannot point migrations or the server at a local catalog.
const directory = mkdtempSync(join(tmpdir(), "eventroam-e2e-"));
const databasePath = join(directory, "catalog.sqlite");
const env = {
  ...process.env,
  DATABASE_PATH: databasePath,
  E2E_DATABASE_PATH: databasePath,
  PUBLIC_APEX_ORIGIN: "http://localhost:3137",
  PUBLIC_FESTIVALS_ORIGIN: "http://festivals.localhost:3137",
  NEXT_PUBLIC_MAPBOX_TOKEN: "",
};

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    console.error(`${command} ended with ${result.signal}`);
    process.exitCode = 1;
    return false;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }
  return true;
}

try {
  if (run("npm", ["run", "db:migrate"]) && run("npm", ["run", "db:fixtures"])) {
    run(process.execPath, [
      "node_modules/@playwright/test/cli.js",
      "test",
      ...process.argv.slice(2),
    ]);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
