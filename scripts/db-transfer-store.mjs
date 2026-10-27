import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

function check(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const results = db.pragma("integrity_check");
    if (results.length !== 1 || results[0].integrity_check !== "ok") {
      throw new Error("SQLite integrity check failed");
    }
    if (db.pragma("foreign_key_check").length) {
      throw new Error("SQLite foreign key check failed");
    }
    // Do not replace the catalog with a workflow or chat database.
    db.prepare("SELECT id FROM events LIMIT 0").all();
    db.prepare("SELECT id FROM editions LIMIT 0").all();
  } finally {
    db.close();
  }
}

async function snapshot(source, target) {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(target);
    fs.chmodSync(target, 0o600);
    closeJournal(target);
    check(target);
  } finally {
    db.close();
  }
}

function closeJournal(file) {
  const db = new Database(file, { fileMustExist: true });
  try {
    db.pragma("busy_timeout = 5000");
    if (db.pragma("wal_checkpoint(TRUNCATE)")[0].busy !== 0) {
      throw new Error("The database is busy; stop all database users");
    }
    if (db.pragma("journal_mode = DELETE", { simple: true }) !== "delete") {
      throw new Error("Cannot close the database journal");
    }
  } finally {
    db.close();
  }
}

async function replace(staged, target) {
  check(staged);
  if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) {
    throw new Error("The target must be a regular file, not a link");
  }
  let backup;
  if (fs.existsSync(target)) {
    const directory = path.join(path.dirname(target), "backups");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    backup = path.join(
      directory,
      `${path.basename(target)}.${new Date().toISOString().replaceAll(":", "-")}.${randomUUID()}.bak`,
    );
    await snapshot(target, backup);
    console.error(`Target backup: ${backup}`);
    // All users must be stopped. Flush the old WAL before replacing its main file.
    closeJournal(target);
  }
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (fs.existsSync(`${target}${suffix}`)) {
      throw new Error(`Target sidecar remains: ${target}${suffix}`);
    }
  }
  fs.chmodSync(staged, 0o600);
  fs.renameSync(staged, target);
  return backup;
}

async function main([direction]) {
  process.umask(0o077);
  const target = "/data/eventroam.sqlite";
  const staged = `/data/.catalog-transfer-${randomUUID()}.sqlite`;
  try {
    if (direction === "pull") {
      await snapshot(target, staged);
      await pipeline(fs.createReadStream(staged), process.stdout);
    } else if (direction === "push") {
      await pipeline(
        process.stdin,
        fs.createWriteStream(staged, { flags: "wx", mode: 0o600 }),
      );
      await replace(staged, target);
    } else {
      throw new Error("Expected pull or push");
    }
  } finally {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      fs.rmSync(`${staged}${suffix}`, { force: true });
    }
  }
}

export { snapshot, replace, main };
