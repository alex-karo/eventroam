import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { submitJobs, cancelPendingJobs } from "./store";
import { workerStoragePaths } from "./worker";

function fixture() {
  const db = testDatabase(),
    fx = testFixtures();
  const eventIds = Array.from({ length: 3 }, () => fx.event().id);
  const batch = submitJobs(db.client, { eventIds, dryRun: false });
  const root = dirname(db.path);
  const env = {
    ...process.env,
    DATABASE_PATH: db.path,
    CATALOG_WORKFLOW_DATABASE_PATH: join(root, "workflows.sqlite"),
    CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH: join(root, "worker.duckdb"),
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(root, "studio.duckdb"),
    CATALOG_CHAT_DATABASE_PATH: join(root, "chat.sqlite"),
    CATALOG_EVAL_DATABASE_PATH: join(root, "mastra-evals.sqlite"),
    CATALOG_TRACING: "false",
    CATALOG_LOGGING: "false",
    OPENROUTER_API_KEY: "",
  };
  const children: ChildProcessWithoutNullStreams[] = [];
  function start(mode: string, command = "src/test/jobs-worker.ts") {
    const child = spawn(
      process.execPath,
      [
        ...(command.endsWith(".mjs") ? [] : ["--import", "tsx"]),
        resolve(command),
        mode,
      ],
      { env, stdio: "pipe" },
    );
    children.push(child);
    let output = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const exited = new Promise<number | null>((done) =>
      child.once("exit", done),
    );
    return { child, exited, output: () => output, stderr: () => stderr };
  }
  const close = async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((done) => child.once("exit", done));
        child.kill("SIGKILL");
        await exited;
      }
    }
  };
  return { ...db, eventIds, ...batch, env, start, close };
}

test.each(["before-attempt", "interrupt", "after-finalize"])(
  "restart from %s runs the saved running job from the beginning and preserves all earlier evidence",
  async (mode) => {
    const f = fixture();
    try {
      const first = f.start(mode);
      await expect
        .poll(first.output, { timeout: 15000 })
        .toContain(mode === "interrupt" ? "RESEARCH" : "PAUSED");
      const before = f.client
        .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
        .all();
      first.child.kill("SIGKILL");
      await first.exited;
      const firstJob = f.client
        .prepare(
          "SELECT id,status FROM ingestion_jobs ORDER BY position LIMIT 1",
        )
        .get() as { id: string; status: string };
      expect(firstJob.status).toBe("running");
      const later = f.start("finish");
      await expect
        .poll(
          () =>
            f.client
              .prepare(
                "SELECT count(*) FROM ingestion_jobs WHERE status='done'",
              )
              .pluck()
              .get(),
          { timeout: 20000 },
        )
        .toBe(3);
      later.child.kill("SIGTERM");
      expect(await later.exited).toBe(0);
      const calls = later
        .output()
        .split("\n")
        .filter((line) => line.startsWith("RESEARCH "))
        .map((line) => JSON.parse(line.slice(9)));
      expect(calls.map((call) => call.id)).toEqual(f.eventIds);
      if (mode === "after-finalize") {
        expect(calls[0].summary).toBe("WORKER_SAVED_SUMMARY");
      }
      const after = f.client
        .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
        .all();
      expect(after.slice(0, before.length)).toEqual(before);
      expect(after).toHaveLength(before.length + 3);
      expect(
        f.client
          .prepare("SELECT count(*) FROM ingestion_runs WHERE job_id=?")
          .pluck()
          .get(firstJob.id),
      ).toBe(mode === "before-attempt" ? 1 : 2);
    } finally {
      await f.close();
    }
  },
  45000,
);

test("SIGTERM stops active work, awaits cleanup, and leaves the job running for restart", async () => {
  const f = fixture();
  f.env.CATALOG_LOGGING = "true";
  f.env.CATALOG_TRACING = "true";
  try {
    const worker = f.start("signal");
    await expect.poll(worker.output, { timeout: 15000 }).toContain("RESEARCH");
    worker.child.kill("SIGTERM");
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
    const { readTraceRows } = await import("@/test/read-observability");
    const savedObservations = await readTraceRows(
      f.env.CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH,
    );
    expect(savedObservations.mastra_ai_spans.length).toBeGreaterThan(0);
    expect(savedObservations.mastra_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Ingestion job interrupted",
          data: expect.objectContaining({
            jobId: expect.any(String),
            batchId: f.batchId,
          }),
        }),
      ]),
    );

    const run = f.client
      .prepare("SELECT status,report_json FROM ingestion_runs")
      .get() as { status: string; report_json: string };
    expect(run.status).toBe("failed");
    expect(JSON.parse(run.report_json).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "workflow_failed" }),
      ]),
    );
    expect(
      f.client
        .prepare(
          "SELECT status,count(*) n FROM ingestion_jobs GROUP BY status ORDER BY status",
        )
        .all(),
    ).toEqual([
      { status: "pending", n: 2 },
      { status: "running", n: 1 },
    ]);
  } finally {
    await f.close();
  }
}, 35000);

test("the real command rejects absent or unmigrated catalogs", async () => {
  const f = fixture();
  try {
    f.env.DATABASE_PATH = join(dirname(f.path), "missing.sqlite");
    const missing = f.start("", "commands/catalog-worker.ts");
    expect(await missing.exited).toBe(1);
    expect(existsSync(f.env.DATABASE_PATH)).toBe(false);
    expect(missing.stderr()).not.toContain(f.env.DATABASE_PATH);
    f.env.DATABASE_PATH = f.path;
    f.client.exec("DROP TABLE ingestion_jobs");
    const unmigrated = f.start("", "commands/catalog-worker.ts");
    expect(await unmigrated.exited).toBe(1);
  } finally {
    await f.close();
  }
}, 30000);

test("worker paths use a separate default and reject explicit file aliases", () => {
  const db = testDatabase(),
    root = dirname(db.path);
  const env = {
    ...process.env,
    DATABASE_PATH: db.path,
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(root, "studio.duckdb"),
    CATALOG_WORKFLOW_DATABASE_PATH: join(root, "history.sqlite"),
  };
  expect(workerStoragePaths(env).observability).toBe(
    resolve("data/mastra-worker-observability.duckdb"),
  );
  expect(() =>
    workerStoragePaths({
      ...env,
      CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH:
        env.CATALOG_OBSERVABILITY_DATABASE_PATH,
    }),
  ).toThrow();
  expect(() =>
    workerStoragePaths({
      ...env,
      CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH: db.path,
    }),
  ).toThrow();
});

test("Studio restart preserves worker history and active queue work", async () => {
  const { startStudioFixture } = await import("@/test/studio-fixture");
  const f = fixture();
  let studio = await startStudioFixture("success", {
    directory: dirname(f.path),
    catalog: false,
  });
  try {
    const active = f.start("interrupt");
    await expect.poll(active.output, { timeout: 15000 }).toContain("RESEARCH");
    const queue = f.client
      .prepare("SELECT * FROM ingestion_jobs ORDER BY position")
      .all();
    const endpoint = "/api/workflows/catalog-ingestion";
    const history = await (
      await fetch(studio.baseUrl + endpoint + "/runs")
    ).json();
    expect(history.runs.length).toBe(1);
    const engineRunId = history.runs[0].runId;
    await studio.stop(true);
    expect(active.child.exitCode).toBeNull();
    expect(
      f.client.prepare("SELECT * FROM ingestion_jobs ORDER BY position").all(),
    ).toEqual(queue);
    studio = await startStudioFixture("success", {
      directory: dirname(f.path),
      catalog: false,
    });
    const saved = await (
      await fetch(studio.baseUrl + endpoint + "/runs/" + engineRunId)
    ).json();
    expect(saved.runId).toBe(engineRunId);
    expect(
      f.client.prepare("SELECT * FROM ingestion_jobs ORDER BY position").all(),
    ).toEqual(queue);
  } finally {
    await studio.stop(true);
    await f.close();
  }
}, 60000);

test("missing worker credentials complete jobs without inventing attempts", async () => {
  const f = fixture();
  try {
    const worker = f.start("", "commands/catalog-worker.ts");
    await expect
      .poll(
        () =>
          f.client
            .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
            .pluck()
            .get(),
        { timeout: 15000 },
      )
      .toBe(3);
    expect(
      f.client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
    ).toBe(0);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
  } finally {
    await f.close();
  }
}, 20000);

test("Studio and worker save interleaved workflow snapshots while shared history is read", async () => {
  const { startStudioFixture, STUDIO_FIXTURE_EVENT_ID } =
    await import("@/test/studio-fixture");
  const f = fixture();
  const fx = testFixtures();
  const event = fx.event({
    id: STUDIO_FIXTURE_EVENT_ID,
    slug: "studio-concurrent-fixture",
    canonicalName: "Studio Fixture Festival",
  });
  fx.eventLink(event, { url: "https://example.org/studio-fixture" });
  const studio = await startStudioFixture("cancel", {
    directory: dirname(f.path),
    catalog: false,
  });
  const endpoint = studio.baseUrl + "/api/workflows/catalog-ingestion";
  try {
    const created = await (
      await fetch(endpoint + "/create-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    ).json();
    const direct = fetch(endpoint + "/start-async?runId=" + created.runId, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputData: {
          mode: "refresh",
          eventId: STUDIO_FIXTURE_EVENT_ID,
          dryRun: true,
        },
      }),
    }).then(async (response) => {
      expect(response.ok, await response.text()).toBe(true);
    });
    const unfinishedDirect = () =>
      f.client
        .prepare(
          "SELECT count(*) FROM ingestion_runs WHERE job_id IS NULL AND finished_at IS NULL",
        )
        .pluck()
        .get();
    await expect.poll(unfinishedDirect, { timeout: 10000 }).toBe(1);
    const worker = f.start("signal");
    await expect.poll(worker.output, { timeout: 10000 }).toContain("RESEARCH");
    await expect
      .poll(
        async () => {
          const response = await fetch(endpoint + "/runs");
          expect(response.ok).toBe(true);
          const history = await response.json();
          expect(history.runs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ runId: created.runId }),
            ]),
          );
          return f.client
            .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
            .pluck()
            .get();
        },
        { timeout: 10000 },
      )
      .toBe(3);
    // Studio writes its terminal snapshot after worker writes, while both hosts stay open.
    expect(unfinishedDirect()).toBe(1);
    const cancelled = await fetch(
      endpoint + "/runs/" + created.runId + "/cancel",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    expect(cancelled.ok, await cancelled.text()).toBe(true);
    await direct;
    await expect.poll(unfinishedDirect, { timeout: 10000 }).toBe(0);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
    const saved = await (await fetch(endpoint + "/runs")).json();
    expect(saved.runs).toHaveLength(4);
    for (const run of saved.runs) {
      const snapshot = await (
        await fetch(endpoint + "/runs/" + run.runId)
      ).json();
      expect(snapshot.status).toBe(
        run.runId === created.runId ? "canceled" : "success",
      );
      expect(snapshot.steps["initialize-run"].output.ingestionRunId).toEqual(
        expect.any(String),
      );
    }
    expect(
      f.client
        .prepare(
          "SELECT count(*) FROM ingestion_runs WHERE finished_at IS NOT NULL",
        )
        .pluck()
        .get(),
    ).toBe(4);
  } finally {
    await studio.stop(true);
    await f.close();
  }
}, 40000);

test("several interrupted and finalized attempts remain attached to one job while pending work is cancelled", async () => {
  const f = fixture();
  try {
    for (const mode of ["interrupt", "after-finalize", "interrupt"]) {
      const worker = f.start(mode);
      await expect
        .poll(worker.output, { timeout: 15000 })
        .toContain(mode === "interrupt" ? "RESEARCH" : "PAUSED");
      worker.child.kill("SIGKILL");
      await worker.exited;
    }
    const earlier = f.client
      .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
      .all();
    expect(earlier).toHaveLength(3);
    expect(cancelPendingJobs(f.client, f.batchId)).toMatchObject({
      cancelledCount: 2,
    });
    const worker = f.start("finish");
    await expect
      .poll(
        () =>
          f.client
            .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
            .pluck()
            .get(),
        { timeout: 15000 },
      )
      .toBe(1);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
    const all = f.client
      .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
      .all() as { job_id: string; finished_at: string | null }[];
    expect(all.slice(0, 3)).toEqual(earlier);
    expect(new Set(all.map((run) => run.job_id)).size).toBe(1);
    expect(all.filter((run) => run.finished_at === null)).toHaveLength(2);
    expect(all.filter((run) => run.finished_at !== null)).toHaveLength(2);
    expect(
      f.client
        .prepare("SELECT summary FROM events WHERE id=?")
        .get(f.eventIds[0]),
    ).toEqual({ summary: "WORKER_SAVED_SUMMARY" });
  } finally {
    await f.close();
  }
}, 45000);

test("workflow storage must initialize before any job is selected", async () => {
  const f = fixture();
  f.env.CATALOG_WORKFLOW_DATABASE_PATH = join(
    dirname(f.path),
    "blocked.sqlite",
  );
  mkdirSync(f.env.CATALOG_WORKFLOW_DATABASE_PATH);
  try {
    const worker = f.start("", "commands/catalog-worker.ts");
    expect(await worker.exited).toBe(1);
    expect(
      f.client.prepare("SELECT DISTINCT status FROM ingestion_jobs").all(),
    ).toEqual([{ status: "pending" }]);
    expect(
      f.client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
    ).toBe(0);
  } finally {
    await f.close();
  }
});

test("the built worker entry starts and stops without opening chat, eval or Studio observation stores", async () => {
  const { build } = await import("esbuild");
  const f = fixture();
  cancelPendingJobs(f.client, f.batchId);
  const outfile = resolve(`.mastra/test-worker-${randomUUID()}.mjs`);
  try {
    await build({
      entryPoints: ["commands/catalog-worker.ts"],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
    });
    const worker = f.start("", outfile);
    await expect
      .poll(() => existsSync(f.env.CATALOG_WORKFLOW_DATABASE_PATH), {
        timeout: 10000,
      })
      .toBe(true);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
    expect(existsSync(f.env.CATALOG_CHAT_DATABASE_PATH)).toBe(false);
    expect(existsSync(f.env.CATALOG_EVAL_DATABASE_PATH)).toBe(false);
    expect(existsSync(f.env.CATALOG_OBSERVABILITY_DATABASE_PATH)).toBe(false);
  } finally {
    await f.close();
    rmSync(outfile, { force: true });
  }
}, 20000);

test("an unavailable worker observation store cannot select Studio's DuckDB as a fallback", async () => {
  const f = fixture();
  writeFileSync(
    f.env.CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH,
    "PRIVATE_INVALID_DUCKDB",
  );
  f.env.CATALOG_LOGGING = "true";
  f.env.CATALOG_TRACING = "true";
  try {
    const worker = f.start("finish");
    await expect
      .poll(
        () =>
          f.client
            .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
            .pluck()
            .get(),
        { timeout: 15000 },
      )
      .toBe(3);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
    expect(existsSync(f.env.CATALOG_OBSERVABILITY_DATABASE_PATH)).toBe(false);
    expect(
      f.client
        .prepare(
          "SELECT count(*) FROM ingestion_runs WHERE finished_at IS NOT NULL",
        )
        .pluck()
        .get(),
    ).toBe(3);
    expect(worker.stderr()).not.toContain("PRIVATE_INVALID_DUCKDB");
  } finally {
    await f.close();
  }
}, 20000);
