import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { createWorkflowStorage } from "../runtime/workflow-storage";
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
      const summaries = f.client
        .prepare("SELECT summary FROM events WHERE id=?")
        .get(f.eventIds[0]);
      if (mode === "after-finalize") {
        expect(summaries).toEqual({ summary: "WORKER_SAVED_SUMMARY" });
      }
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
      expect(later.output().match(/RESEARCH/g)).toHaveLength(3);
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
      expect(new Set(after.map((row) => (row as { id: string }).id)).size).toBe(
        after.length,
      );
      expect(
        f.client
          .prepare("SELECT count(*) FROM ingestion_runs WHERE job_id=?")
          .pluck()
          .get(firstJob.id),
      ).toBe(mode === "before-attempt" ? 1 : 2);
      // Both queue counts and joined history remain complete.
      expect(
        f.client
          .prepare(
            "SELECT status,count(*) n FROM ingestion_jobs GROUP BY status",
          )
          .all(),
      ).toEqual([{ status: "done", n: 3 }]);
      const saved = createWorkflowStorage({
        path: f.env.CATALOG_WORKFLOW_DATABASE_PATH,
      });
      try {
        await saved.init();
        const runs = await (await saved.getStore(
          "workflows",
        ))!.listWorkflowRuns({
          workflowName: "catalog-ingestion",
          perPage: 200,
          page: 0,
        });
        expect(runs.runs.length).toBe(before.length + 3);
      } finally {
        await saved.close();
      }
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
    expect(worker.stderr()).not.toContain("Worker fixture failed");
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
    expect(cancelPendingJobs(f.client, f.batchId)).toMatchObject({
      cancelledCount: 2,
    });
    const restarted = f.start("finish");
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
    restarted.child.kill("SIGTERM");
    expect(await restarted.exited).toBe(0);
    expect(
      f.client
        .prepare(
          "SELECT status,count(*) n FROM ingestion_jobs GROUP BY status ORDER BY status",
        )
        .all(),
    ).toEqual([
      { status: "cancelled", n: 2 },
      { status: "done", n: 1 },
    ]);
  } finally {
    await f.close();
  }
}, 35000);

test("the real command opens an empty queue without keys and rejects absent or unmigrated catalogs", async () => {
  const f = fixture();
  cancelPendingJobs(f.client, f.batchId);
  try {
    const worker = f.start("", "commands/catalog-worker.ts");
    await expect
      .poll(() => existsSync(f.env.CATALOG_WORKFLOW_DATABASE_PATH), {
        timeout: 10000,
      })
      .toBe(true);
    await expect
      .poll(
        () => existsSync(f.env.CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH),
        { timeout: 10000 },
      )
      .toBe(true);
    expect(existsSync(f.env.CATALOG_OBSERVABILITY_DATABASE_PATH)).toBe(false);
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toBe(0);
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

test("Studio reads worker history, runs the direct form, and restarts without changing active queue work", async () => {
  const { startStudioFixture, STUDIO_FIXTURE_EVENT_ID } =
    await import("@/test/studio-fixture");
  const f = fixture();
  const fx = testFixtures();
  const event = fx.event({
    id: STUDIO_FIXTURE_EVENT_ID,
    slug: "studio-direct-fixture",
    canonicalName: "Studio Fixture Festival",
  });
  fx.eventLink(event, { url: "https://example.org/studio-fixture" });
  let studio = await startStudioFixture("success", {
    directory: dirname(f.path),
    catalog: false,
  });
  let stopped = false;
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
    const created = await (
      await fetch(studio.baseUrl + endpoint + "/create-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    ).json();
    const direct = await fetch(
      studio.baseUrl + endpoint + "/start?runId=" + created.runId,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputData: {
            mode: "refresh",
            eventId: STUDIO_FIXTURE_EVENT_ID,
            dryRun: true,
            republish: false,
          },
        }),
      },
    );
    const directText = await direct.text();
    expect(direct.ok, directText).toBe(true);
    await expect
      .poll(
        () =>
          f.client
            .prepare(
              "SELECT count(*) FROM ingestion_runs WHERE job_id IS NULL AND finished_at IS NOT NULL",
            )
            .pluck()
            .get(),
        { timeout: 10000, message: directText },
      )
      .toBe(1);
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
    active.child.kill("SIGKILL");
    await active.exited;
    const resumed = f.start("finish");
    await expect
      .poll(
        () =>
          f.client
            .prepare("SELECT count(*) FROM ingestion_jobs WHERE status='done'")
            .pluck()
            .get(),
        { timeout: 20000 },
      )
      .toBe(3);
    resumed.child.kill("SIGTERM");
    expect(await resumed.exited).toBe(0);
    const all = await (await fetch(studio.baseUrl + endpoint + "/runs")).json();
    expect(all.runs.length).toBe(5);
    await studio.stop(true);
    stopped = true;
    // Inspect the worker's private observation file only after its writer stops.
    const { createObservabilityStore } =
      await import("../runtime/observability/storage");
    const observations = await createObservabilityStore({
      ...f.env,
      CATALOG_OBSERVABILITY_DATABASE_PATH:
        f.env.CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH,
    });
    await observations.init();
    await observations.close();
  } finally {
    if (!stopped) {
      await studio.stop(true);
    }
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
    expect(unfinishedDirect()).toBe(1);
    const observed = new Set<string>();
    await expect
      .poll(
        async () => {
          const response = await fetch(endpoint + "/runs");
          expect(response.ok).toBe(true);
          const history = await response.json();
          for (const run of history.runs) {
            observed.add(run.runId);
          }
          expect(observed.has(created.runId)).toBe(true);
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
    expect(observed.size).toBe(4);
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

test("the built worker entry starts with no HTTP, chat or eval resources", async () => {
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
    expect(existsSync(join(dirname(f.path), "chat.sqlite"))).toBe(false);
    expect(existsSync(join(dirname(f.path), "mastra-evals.sqlite"))).toBe(
      false,
    );
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
