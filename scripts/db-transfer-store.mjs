import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

function filesFor(env, withMastra, remote = false) {
  const definitions = [
    ["eventroam.sqlite", "DATABASE_PATH", "catalog"],
    ["mastra-workflows.sqlite", "CATALOG_WORKFLOW_DATABASE_PATH", "sqlite"],
    ["mastra-chat.sqlite", "CATALOG_CHAT_DATABASE_PATH", "sqlite"],
    [
      "mastra-observability.duckdb",
      "CATALOG_OBSERVABILITY_DATABASE_PATH",
      "duckdb",
    ],
  ];
  const files = definitions
    .slice(0, withMastra ? 4 : 1)
    .map(([name, key, kind]) => ({
      name,
      kind,
      path: path.resolve(
        remote ? "/data/" + name : env[key]?.trim() || `data/${name}`,
      ),
    }));
  const paths = files.flatMap((file) => [file.path, ...sidecars(file)]);
  const identities = paths.map((file) => {
    if (!fs.existsSync(file)) {
      return file;
    }
    const stat = fs.statSync(file);
    return `${stat.dev}:${stat.ino}`;
  });
  if (new Set(identities).size !== identities.length) {
    throw new Error("Database paths and their sidecars must be separate");
  }
  return files;
}

function sidecars(file) {
  return file.kind === "duckdb"
    ? [`${file.path}.wal`]
    : ["-wal", "-shm", "-journal"].map((suffix) => file.path + suffix);
}

async function checkpointDuckDB(file) {
  // Use the same runtime as Mastra without initializing its tables or migrations.
  const { DuckDBConnection } = await import("@mastra/duckdb");
  const db = new DuckDBConnection({ path: file, threads: 1 });
  try {
    await db.execute("CHECKPOINT");
  } finally {
    await db.close();
  }
}

async function check(file, kind) {
  if (!fs.lstatSync(file).isFile()) {
    throw new Error(`Expected a regular database file: ${file}`);
  }
  if (kind === "duckdb") {
    await checkpointDuckDB(file);
    return;
  }
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const results = db.pragma("integrity_check");
    if (results.length !== 1 || results[0].integrity_check !== "ok") {
      throw new Error("SQLite integrity check failed");
    }
    if (db.pragma("foreign_key_check").length) {
      throw new Error("SQLite foreign key check failed");
    }
    if (kind === "catalog") {
      db.prepare("SELECT id FROM events LIMIT 0").all();
      db.prepare("SELECT id FROM editions LIMIT 0").all();
    }
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

async function snapshot(source, target, kind) {
  if (!fs.lstatSync(source).isFile()) {
    throw new Error(`Expected a regular database file: ${source}`);
  }
  if (kind === "duckdb") {
    // Source users must be stopped before copying the database and its WAL.
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    if (fs.existsSync(`${source}.wal`)) {
      fs.copyFileSync(
        `${source}.wal`,
        `${target}.wal`,
        fs.constants.COPYFILE_EXCL,
      );
    }
  } else {
    const db = new Database(source, { readonly: true, fileMustExist: true });
    try {
      await db.backup(target);
      closeJournal(target);
    } finally {
      db.close();
    }
  }
  fs.chmodSync(target, 0o600);
  await check(target, kind);
}

async function createBundle(files, directory, output) {
  for (const file of files) {
    await snapshot(file.path, path.join(directory, file.name), file.kind);
  }
  execFileSync(
    "tar",
    ["-cf", "-", "-C", directory, ...files.map((file) => file.name)],
    {
      stdio: ["ignore", output, "inherit"],
    },
  );
}

async function installBundle(archive, files, directory) {
  const names = files.map((file) => file.name);
  const entries = execFileSync("tar", ["-tf", archive], { encoding: "utf8" })
    .trim()
    .split("\n");
  if (
    entries.length !== names.length ||
    new Set(entries).size !== names.length ||
    entries.some((name) => !names.includes(name))
  ) {
    throw new Error(
      "The transfer archive does not contain the selected databases",
    );
  }
  execFileSync("tar", ["-xf", archive, "-C", directory, ...names]);
  const staged = [];
  try {
    // Prepare every file and every target backup before the first replacement.
    for (const file of files) {
      const incoming = path.join(directory, file.name);
      await check(incoming, file.kind);
      fs.mkdirSync(path.dirname(file.path), { recursive: true });
      const next = { ...file, path: `${file.path}.transfer-${randomUUID()}` };
      staged.push(next);
      await snapshot(incoming, next.path, file.kind);
    }
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        const backups = path.join(path.dirname(file.path), "backups");
        fs.mkdirSync(backups, { recursive: true, mode: 0o700 });
        const backup = path.join(
          backups,
          `${path.basename(file.path)}.${new Date().toISOString().replaceAll(":", "-")}.${randomUUID()}.bak`,
        );
        await snapshot(file.path, backup, file.kind);
        console.error(`Target backup: ${backup}`);
      }
    }
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        if (file.kind === "duckdb") {
          await checkpointDuckDB(file.path);
        } else {
          closeJournal(file.path);
        }
      }
      for (const extra of sidecars(file)) {
        if (fs.existsSync(extra)) {
          throw new Error(`Target sidecar remains: ${extra}`);
        }
      }
    }
    for (let i = 0; i < files.length; i++) {
      fs.renameSync(staged[i].path, files[i].path);
    }
  } finally {
    for (const file of staged) {
      for (const extra of [file.path, ...sidecars(file)]) {
        fs.rmSync(extra, { force: true });
      }
    }
  }
}

async function main([direction, scope]) {
  process.umask(0o077);
  const files = filesFor(process.env, scope === "all", true);
  const directory = fs.mkdtempSync("/data/.db-transfer-");
  try {
    if (direction === "pull") {
      await createBundle(files, directory, 1);
    } else if (direction === "push") {
      const archive = path.join(directory, "transfer.tar");
      await pipeline(
        process.stdin,
        fs.createWriteStream(archive, { flags: "wx", mode: 0o600 }),
      );
      await installBundle(archive, files, directory);
    } else {
      throw new Error("Expected pull or push");
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export { filesFor, createBundle, installBundle, main };
