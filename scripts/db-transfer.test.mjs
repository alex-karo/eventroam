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
import { join, resolve } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";

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
    DB_SSH_HOST: "test-host",
    TEST_ROOT: root,
    TEST_LOG: log,
  };
  function run(direction) {
    return spawnSync(
      process.execPath,
      ["scripts/db-transfer.mjs", direction, "--local-stopped"],
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
  return { root, local, remote, localFile, remoteFile, run, calls };
}

test("pull includes WAL data and keeps a valid local backup", (t) => {
  const fx = fixture(t);
  const writer = new Database(fx.remoteFile);
  writer.pragma("journal_mode = WAL");
  writer.prepare("UPDATE events SET id = ?").run("remote-wal");
  let result;
  try {
    assert.ok(existsSync(`${fx.remoteFile}-wal`));
    result = fx.run("pull");
  } finally {
    writer.close();
  }
  assert.equal(result.status, 0, result.stderr);
  assert.equal(value(fx.localFile), "remote-wal");
  const backups = readdirSync(join(fx.local, "backups"));
  assert.equal(backups.length, 1);
  assert.equal(value(join(fx.local, "backups", backups[0])), "local");
  assert.equal(value(fx.remoteFile), "remote-wal");
  assert.ok(fx.calls().some((call) => call[0] === "start"));
});

test("push backs up remote catalog and restarts services", (t) => {
  const fx = fixture(t);
  const result = fx.run("push");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(value(fx.remoteFile), "local");
  const backups = readdirSync(join(fx.remote, "backups"));
  assert.equal(value(join(fx.remote, "backups", backups[0])), "remote");
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

test("failed remote backup keeps the target and skips automatic restart", (t) => {
  const fx = fixture(t);
  writeFileSync(join(fx.remote, "backups"), "blocked backup directory");
  const result = fx.run("push");
  assert.notEqual(result.status, 0);
  assert.equal(value(fx.remoteFile), "remote");
  assert.match(result.stderr, /Automatic restart was skipped/);
  assert.ok(!fx.calls().some((call) => call[0] === "start"));
});
