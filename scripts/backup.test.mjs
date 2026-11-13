import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function fixture(t, exit = 0, studio = true) {
  const root = mkdtempSync(join(tmpdir(), "eventroam-backup-host-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = join(root, "state.json");
  writeFileSync(
    state,
    JSON.stringify({
      web: true,
      studio,
      calls: [],
      pruned: false,
    }),
  );
  const tool = (name, code) => {
    const path = join(root, name);
    writeFileSync(path, `#!${process.execPath} --\n${code}`);
    chmodSync(path, 0o700);
  };
  tool("flock", "process.exit(0);");
  tool(
    "docker",
    `
const fs = require('node:fs');
const args = process.argv.slice(2);
const file = process.env.TEST_STATE;
const state = JSON.parse(fs.readFileSync(file));
state.calls.push(args);
let code = 0;
const service = id => id === 'aaaaaaaaaaaa' ? 'web' : 'studio';
if (args[0] === 'ps') console.log(args.some(x => x.endsWith('service=web')) ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb');
else if (args[0] === 'inspect') {
  const format=args[2];
  if (format.includes('.Mounts')) console.log('eventroam_data');
  else if (format.includes('.Image')) console.log('sha256:fixture');
  else if (format.includes('.State.Running')) console.log(state[service(args.at(-1))] ? 'true' : 'false');
} else if (args[0] === 'compose') {
  const worker = args.indexOf('database');
  const restic = args.indexOf('restic');
  if (args.includes('start') || args.includes('stop')) {
    for (const name of args.filter(x => x === 'web' || x === 'studio')) state[name] = args.includes('start');
  } else if (worker >= 0) {
    const command = args[worker+1];
    if (command === 'prune') state.pruned=true;
    if (command === 'pause') state.paused=true;
    if (command === 'resume') state.paused=false;
  } else if (restic >= 0) {
    if (args.includes('backup')) { state.uploadState={web:state.web,studio:state.studio,paused:state.paused}; console.log('snapshot bbbbbbbb saved'); code=Number(process.env.TEST_BACKUP_EXIT || 0); }
  }
}
fs.writeFileSync(file, JSON.stringify(state));
process.exit(code);
`,
  );
  mkdirSync(join(root, "scripts"));
  const script = join(root, "scripts/backup.sh");
  writeFileSync(
    script,
    readFileSync(new URL("./backup.sh", import.meta.url), "utf8").replaceAll(
      "/var/lock/eventroam-maintenance.lock",
      join(root, "maintenance.lock"),
    ),
  );
  const env = {
    ...process.env,
    PATH: `${root}:${process.env.PATH}`,
    TEST_STATE: state,
    TEST_BACKUP_EXIT: String(exit),
  };
  const run = () =>
    spawnSync("bash", [script, "run"], {
      env,
      encoding: "utf8",
      timeout: 15000,
    });
  return { root, run, state: () => JSON.parse(readFileSync(state)) };
}

test("a successful backup precedes cleanup, restart, and repository retention", (t) => {
  for (const studio of [true, false]) {
    const f = fixture(t, 0, studio),
      result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const state = f.state();
    for (const args of state.calls.filter((x) => x[0] === "compose")) {
      assert.equal(
        args[args.indexOf("-f") + 1],
        join(
          f.root,
          args.includes("run") ? "compose.backup.yaml" : "compose.yaml",
        ),
      );
      if (args.includes("start")) {
        assert.ok(args.includes("--wait"));
        assert.equal(args[args.indexOf("--wait-timeout") + 1], "120");
      }
    }
    const backup = state.calls.findIndex((x) => x.includes("backup"));
    const prune = state.calls.findIndex((x) => x.includes("prune"));
    const restart = state.calls.findIndex(
      (x, i) => i > prune && x.includes("start"),
    );
    const forget = state.calls.findIndex((x) => x.includes("forget"));
    assert.ok(
      backup > 0 && prune > backup && restart > prune && forget > restart,
    );
    assert.ok(state.calls[forget].includes("--keep-within"));
    assert.ok(state.calls[forget].includes("6m"));
    assert.ok(state.calls[backup].includes("image=sha256:fixture"));
    assert.equal(state.paused, false);
    assert.equal(state.studio, studio);
    assert.deepEqual(state.uploadState, {
      web: true,
      studio: false,
      paused: true,
    });
    assert.deepEqual(
      state.calls[backup].filter((x) => x.startsWith("/data/")),
      [
        "/data/eventroam.sqlite",
        "/data/mastra-workflows.sqlite",
        "/data/mastra-chat.sqlite",
        "/data/mastra-evals.sqlite",
        "/data/mastra-observability.duckdb",
        "/data/ingestion-sources",
      ],
    );
  }
});

test("an incomplete backup skips cleanup and restores the service state", (t) => {
  for (const studio of [true, false]) {
    const f = fixture(t, 3, studio);
    assert.notEqual(f.run().status, 0);
    const state = f.state();
    assert.equal(state.pruned, false);
    assert.equal(state.paused, false);
    assert.equal(state.web, true);
    assert.equal(state.studio, studio);
    assert.ok(!state.calls.some((x) => x.includes("forget")));
  }
});
