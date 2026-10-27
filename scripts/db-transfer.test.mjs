import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { DuckDBConnection } from "@mastra/duckdb";

function database(file, value) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE events(id TEXT PRIMARY KEY); CREATE TABLE editions(id TEXT PRIMARY KEY)",
  );
  db.prepare("INSERT INTO events VALUES (?)").run(value);
  return db;
}

function value(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT id FROM events").get().id;
  } finally {
    db.close();
  }
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "catalog-transfer-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const local = join(root, "local");
  const remote = join(root, "remote");
  const bin = join(root, "bin");
  for (const dir of [local, remote, bin]) {
    mkdirSync(dir);
  }
  const localFile = join(local, "eventroam.sqlite");
  const remoteFile = join(remote, "eventroam.sqlite");
  database(localFile, "local").close();
  database(remoteFile, "remote").close();
  const log = join(root, "calls.jsonl");
  const writeTool = (name, code) => {
    const file = join(bin, name);
    writeFileSync(file, `#!${process.execPath}\n${code}`);
    chmodSync(file, 0o700);
  };
  writeTool(
    "ssh",
    `
const {spawnSync} = require('node:child_process');
let command = process.argv.at(-1);
command = command.replaceAll('/data/', process.env.TEST_ROOT + '/remote/');
const result = spawnSync('bash', ['-c', command], {stdio:'inherit'});
process.exit(result.status ?? 1);
`,
  );
  writeTool(
    "docker",
    `
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'ps') {
  console.log(args.some(arg => arg.endsWith('service=web')) ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb');
} else if (args[0] === 'inspect') {
  const format = args[2];
  if (format.includes('.Mounts')) console.log('test_catalog_data');
  else if (format.includes('.Image')) console.log('test-image');
  else if (format.includes('.State.Running')) console.log('true');
} else if (args[0] === 'run') {
  const worker = args.indexOf('-e');
  if (worker >= 0) {
    const result = spawnSync(process.execPath, ["--input-type=module", ...args.slice(worker)], {stdio:'inherit'});
    process.exit(result.status ?? 1);
  }
}
`,
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    DATABASE_PATH: localFile,
    CATALOG_WORKFLOW_DATABASE_PATH: join(local, "workflows.sqlite"),
    CATALOG_CHAT_DATABASE_PATH: join(local, "chat.sqlite"),
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(local, "observability.duckdb"),
    DB_SSH_HOST: "test-host",
    TEST_ROOT: root,
    TEST_LOG: log,
  };
  function run(direction, withMastra = false) {
    return spawnSync(
      process.execPath,
      [
        "scripts/db-transfer.mjs",
        direction,
        "--local-stopped",
        ...(withMastra ? ["--with-mastra"] : []),
      ],
      {
        env,
        cwd: resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        timeout: 30000,
      },
    );
  }
  const calls = () =>
    readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  return { root, local, remote, localFile, remoteFile, run, calls, env };
}

async function readStore(file, duckdb) {
  if (duckdb) {
    const db = new DuckDBConnection({ path: file, threads: 1 });
    try {
      return (await db.query("SELECT value FROM records"))[0].value;
    } finally {
      await db.close();
    }
  }
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT value FROM records").get().value;
  } finally {
    db.close();
  }
}

function seedMastra(fx) {
  const files = [
    {
      name: "mastra-workflows.sqlite",
      local: fx.env.CATALOG_WORKFLOW_DATABASE_PATH,
    },
    { name: "mastra-chat.sqlite", local: fx.env.CATALOG_CHAT_DATABASE_PATH },
    {
      name: "mastra-observability.duckdb",
      local: fx.env.CATALOG_OBSERVABILITY_DATABASE_PATH,
      duckdb: true,
    },
  ].map((file) => ({ ...file, remote: join(fx.remote, file.name) }));
  for (const file of files) {
    for (const side of ["local", "remote"]) {
      if (file.duckdb) {
        // Exit without close so committed records remain in the DuckDB WAL.
        const result = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `
          import { DuckDBConnection } from "@mastra/duckdb";
          const db = new DuckDBConnection({ path: process.argv[1], threads: 1 });
          await db.execute("CREATE TABLE records(value TEXT)");
          await db.execute("INSERT INTO records VALUES (?)", [process.argv[2]]);
          process.exit(0);
        `,
            file[side],
            side,
          ],
          { encoding: "utf8", timeout: 10000 },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(file[side] + ".wal"));
      } else {
        const db = new Database(file[side]);
        db.exec("CREATE TABLE records(value TEXT)");
        db.prepare("INSERT INTO records VALUES (?)").run(side);
        db.close();
      }
    }
  }
  return files;
}

async function checkMastra(files, targetSide, incoming, previous) {
  for (const file of files) {
    assert.equal(await readStore(file[targetSide], file.duckdb), incoming);
    const backups = join(resolve(file[targetSide], ".."), "backups");
    const backup = readdirSync(backups).find((name) =>
      name.startsWith(basename(file[targetSide]) + "."),
    );
    assert.ok(backup);
    assert.equal(await readStore(join(backups, backup), file.duckdb), previous);
  }
}

test("pull includes SQLite and DuckDB WAL data and backs up all targets", async (t) => {
  const fx = fixture(t);
  const mastra = seedMastra(fx);
  const writer = new Database(fx.remoteFile);
  writer.pragma("journal_mode = WAL");
  writer.prepare("UPDATE events SET id = ?").run("remote-wal");
  let result;
  try {
    assert.ok(existsSync(`${fx.remoteFile}-wal`));
    result = fx.run("pull", true);
  } finally {
    writer.close();
  }
  assert.equal(result.status, 0, result.stderr);
  assert.equal(value(fx.localFile), "remote-wal");
  const backups = readdirSync(join(fx.local, "backups"));
  assert.equal(backups.length, 4);
  const catalogBackup = backups.find((name) =>
    name.startsWith("eventroam.sqlite."),
  );
  assert.equal(value(join(fx.local, "backups", catalogBackup)), "local");
  await checkMastra(mastra, "local", "remote", "local");
  assert.ok(fx.calls().some((call) => call[0] === "start"));
});

test("push backs up all remote stores and restarts services", async (t) => {
  const fx = fixture(t);
  const mastra = seedMastra(fx);
  const result = fx.run("push", true);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(value(fx.remoteFile), "local");
  const backups = readdirSync(join(fx.remote, "backups"));
  const catalogBackup = backups.find((name) =>
    name.startsWith("eventroam.sqlite."),
  );
  assert.equal(value(join(fx.remote, "backups", catalogBackup)), "remote");
  await checkMastra(mastra, "remote", "local", "remote");
  const calls = fx.calls();
  const stop = calls.findIndex((call) => call[0] === "stop");
  const install = calls.findIndex((call) => call.includes("-e"));
  const start = calls.findIndex((call) => call[0] === "start");
  assert.ok(stop < install && install < start);
  assert.equal(calls.filter((call) => call[0] === "run").length, 1);
  assert.ok(
    calls[install].includes("type=volume,src=test_catalog_data,dst=/data"),
  );
});

test("invalid remote catalog leaves local target intact and restarts remote", (t) => {
  const fx = fixture(t);
  writeFileSync(fx.remoteFile, "not sqlite");
  const result = fx.run("pull");
  assert.notEqual(result.status, 0);
  assert.equal(value(fx.localFile), "local");
  assert.ok(fx.calls().some((call) => call[0] === "start"));
});

test("a late backup failure keeps every target and skips automatic restart", async (t) => {
  const fx = fixture(t);
  const mastra = seedMastra(fx);
  const diagnostics = mastra.find((file) => file.duckdb);
  rmSync(diagnostics.remote + ".wal");
  writeFileSync(diagnostics.remote, "invalid DuckDB target");
  const result = fx.run("push", true);
  assert.notEqual(result.status, 0);
  assert.equal(value(fx.remoteFile), "remote");
  for (const file of mastra.filter((file) => !file.duckdb)) {
    assert.equal(await readStore(file.remote, false), "remote");
  }
  assert.equal(
    readFileSync(diagnostics.remote, "utf8"),
    "invalid DuckDB target",
  );
  assert.equal(
    readdirSync(join(fx.remote, "backups")).filter((name) =>
      name.endsWith(".bak"),
    ).length,
    4,
  );
  assert.match(result.stderr, /Automatic restart was skipped/);
  assert.ok(!fx.calls().some((call) => call[0] === "start"));
});
