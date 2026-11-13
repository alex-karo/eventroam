import {
  mkdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { checkDatabases } from "../src/backup/storage";
import { applyRetention } from "../src/backup/retention";

async function waitForStudio(pauseFile: string) {
  if (readFileSync(pauseFile, "utf8") !== "backup\n") {
    throw new Error("Backup pause file is missing");
  }
  const deadline = Date.now() + 60 * 60_000;
  while (Date.now() < deadline) {
    const response = await fetch("http://127.0.0.1:4111/ingestion-queue", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error("Studio queue is unavailable; backup drain failed");
    }
    const status = await response.json();
    if (status.paused === true && status.active === 0) {
      return;
    }
    await delay(1000);
  }
  throw new Error("Studio is still busy after one hour; backup skipped");
}

async function main([command, ...args]: string[]) {
  const root = "/data";
  const pauseFile = join(root, ".eventroam-maintenance");
  if (command === "pause") {
    const disk = statfsSync(root);
    if (disk.bavail * disk.bsize < 1024 ** 3) {
      throw new Error(
        "Backup needs at least 1 GiB of free space for database maintenance",
      );
    }
    writeFileSync(pauseFile, "backup\n", { flag: "wx", mode: 0o600 });
    return;
  }
  if (command === "drain") {
    return waitForStudio(pauseFile);
  }
  if (command === "resume") {
    rmSync(pauseFile, { force: true });
  } else if (command === "prepare" && args.length === 0) {
    await checkDatabases(root, true);
    mkdirSync(join(root, "ingestion-sources"), {
      recursive: true,
      mode: 0o700,
    });
  } else if (command === "prune" && args.length === 0) {
    await applyRetention(root);
  } else if (command === "verify" && args.length === 0) {
    await checkDatabases("/restore/data", false);
    console.log("Restore check passed.");
  } else {
    throw new Error("Expected pause, drain, resume, prepare, prune, or verify");
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Backup command failed",
  );
  process.exitCode = 1;
});
