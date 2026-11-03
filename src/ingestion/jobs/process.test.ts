import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { submitJobs, cancelPendingJobs } from "./store";

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
    CATALOG_OBSERVABILITY_DATABASE_PATH: join(root, "studio.duckdb"),
    CATALOG_CHAT_DATABASE_PATH: join(root, "chat.sqlite"),
    CATALOG_EVAL_DATABASE_PATH: join(root, "mastra-evals.sqlite"),
    CATALOG_TRACING: "false",
    CATALOG_LOGGING: "false",
    OPENROUTER_API_KEY: "",
  };
  const children: ChildProcessWithoutNullStreams[] = [];
  function start(mode: string) {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", resolve("src/test/jobs-studio.ts"), mode],
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

async function studioUrl(
  server: ReturnType<ReturnType<typeof fixture>["start"]>,
) {
  await expect.poll(server.output, { timeout: 15000 }).toContain("STUDIO_URL ");
  return /STUDIO_URL (http:\/\/[^\s]+)/.exec(server.output())![1];
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
      let oldEngineRunId: string | undefined;
      if (mode === "interrupt") {
        const url = await studioUrl(first);
        const history = await (
          await fetch(url + "/api/workflows/catalog-ingestion/runs")
        ).json();
        oldEngineRunId = history.runs[0].runId;
      }
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
      const laterUrl = await studioUrl(later);
      const history = await (
        await fetch(laterUrl + "/api/workflows/catalog-ingestion/runs")
      ).json();
      expect(history.runs).toHaveLength(mode === "before-attempt" ? 3 : 4);
      expect(
        new Set(history.runs.map((run: { runId: string }) => run.runId)).size,
      ).toBe(history.runs.length);
      if (oldEngineRunId) {
        const saved = await (
          await fetch(
            laterUrl +
              "/api/workflows/catalog-ingestion/runs/" +
              oldEngineRunId,
          )
        ).json();
        expect(saved.runId).toBe(oldEngineRunId);
        expect(
          history.runs.filter(
            (run: { runId: string }) => run.runId !== oldEngineRunId,
          ),
        ).toHaveLength(3);
      }
      later.child.kill("SIGTERM");
      expect(await later.exited).toBe(0);
      const calls = later
        .output()
        .split("\n")
        .filter((line) => line.startsWith("RESEARCH "))
        .map((line) => JSON.parse(line.slice(9)));
      expect(calls.map((call) => call.id)).toEqual(f.eventIds);
      if (mode === "after-finalize") {
        expect(calls[0].summary).toBe("STUDIO_SAVED_SUMMARY");
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

test("SIGTERM stops queued work before HTTP drain, awaits cleanup, and preserves the running job", async () => {
  const f = fixture();
  f.env.CATALOG_LOGGING = "true";
  f.env.CATALOG_TRACING = "true";
  try {
    const studio = f.start("signal");
    const url = await studioUrl(studio);
    await expect.poll(studio.output, { timeout: 15000 }).toContain("RESEARCH");
    const endpoint = url + "/api/workflows/catalog-ingestion";
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
        inputData: { mode: "refresh", eventId: f.eventIds[2], dryRun: true },
      }),
    }).then(async (response) => {
      await response.text();
      return response.ok;
    });
    await expect
      .poll(
        () =>
          f.client
            .prepare(
              "SELECT count(*) FROM ingestion_runs WHERE job_id IS NULL AND finished_at IS NULL",
            )
            .pluck()
            .get(),
        { timeout: 5000 },
      )
      .toBe(1);
    studio.child.kill("SIGTERM");
    studio.child.kill("SIGTERM");
    expect(await direct).toBe(true);
    expect(await studio.exited).toBe(0);
    const { readTraceRows } = await import("@/test/read-observability");
    const savedObservations = await readTraceRows(
      f.env.CATALOG_OBSERVABILITY_DATABASE_PATH,
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
      .prepare(
        "SELECT status,report_json FROM ingestion_runs WHERE job_id IS NOT NULL",
      )
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

test("missing studio credentials complete jobs without inventing attempts", async () => {
  const f = fixture();
  try {
    const studio = f.start("credentials");
    await studioUrl(studio);
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
    studio.child.kill("SIGTERM");
    expect(await studio.exited).toBe(0);
  } finally {
    await f.close();
  }
}, 20000);

test("several interrupted and finalized attempts remain attached to one job while pending work is cancelled", async () => {
  const f = fixture();
  try {
    for (const mode of ["interrupt", "after-finalize", "interrupt"]) {
      const studio = f.start(mode);
      await expect
        .poll(studio.output, { timeout: 15000 })
        .toContain(mode === "interrupt" ? "RESEARCH" : "PAUSED");
      studio.child.kill("SIGKILL");
      await studio.exited;
    }
    const earlier = f.client
      .prepare("SELECT * FROM ingestion_runs ORDER BY rowid")
      .all();
    expect(earlier).toHaveLength(3);
    expect(cancelPendingJobs(f.client, f.batchId)).toMatchObject({
      cancelledCount: 2,
    });
    const studio = f.start("finish");
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
    studio.child.kill("SIGTERM");
    expect(await studio.exited).toBe(0);
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
    ).toEqual({ summary: "STUDIO_SAVED_SUMMARY" });
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
    const studio = f.start("credentials");
    expect(await studio.exited).toBe(1);
    expect(
      f.client.prepare("SELECT DISTINCT status FROM ingestion_jobs").all(),
    ).toEqual([{ status: "pending" }]);
    expect(
      f.client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
    ).toBe(0);
  } finally {
    await f.close();
  }
}, 30000);

test("Studio serves queued workflow history and correlated traces from its open store", async () => {
  const f = fixture();
  f.env.CATALOG_TRACING = "true";
  f.env.CATALOG_LOGGING = "true";
  try {
    const studio = f.start("signal");
    const url = await studioUrl(studio);
    expect((await fetch(url + "/ingestion-queue")).status).toBe(200);
    const endpoint = url + "/api/workflows/catalog-ingestion";
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
        inputData: { mode: "refresh", eventId: f.eventIds[1], dryRun: true },
      }),
    });
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
    expect((await direct).ok).toBe(true);
    const history = await (
      await fetch(url + "/api/workflows/catalog-ingestion/runs")
    ).json();
    expect(history.runs).toHaveLength(4);
    for (const run of history.runs) {
      const snapshot = await (
        await fetch(url + "/api/workflows/catalog-ingestion/runs/" + run.runId)
      ).json();
      expect(snapshot.status).toBe("success");
      expect(snapshot.steps).toHaveProperty("general-facts");
      expect(snapshot.steps).toHaveProperty("review-proposals");
    }
    const traces = await (
      await fetch(
        url +
          "/api/observability/traces?entityType=workflow_run&entityId=catalog-ingestion&perPage=100",
      )
    ).json();
    expect(traces.spans).toHaveLength(4);
    expect(traces.spans).toEqual(
      expect.arrayContaining(
        history.runs.map((run: { runId: string }) =>
          expect.objectContaining({
            spanType: "workflow_run",
            entityId: "catalog-ingestion",
            runId: run.runId,
          }),
        ),
      ),
    );
    const metrics = await (
      await fetch(url + "/api/observability/metrics?perPage=100")
    ).json();
    expect(
      metrics.metrics.filter(
        (metric: { name: string }) =>
          metric.name === "mastra_workflow_duration_ms",
      ),
    ).toHaveLength(4);
    expect(
      f.client
        .prepare("SELECT count(*) FROM ingestion_runs WHERE job_id IS NULL")
        .pluck()
        .get(),
    ).toBe(1);
    const logs = await (
      await fetch(url + "/api/observability/logs?perPage=100")
    ).json();
    expect(logs.logs.length).toBeGreaterThan(0);
    expect(
      f.client
        .prepare("SELECT count(*) FROM ingestion_runs WHERE job_id IS NOT NULL")
        .pluck()
        .get(),
    ).toBe(3);
    studio.child.kill("SIGTERM");
    expect(await studio.exited).toBe(0);
  } finally {
    await f.close();
  }
}, 40000);

test.each(["missing", "unmigrated"])(
  "Studio remains available for inspection when the queue catalog is %s",
  async (kind) => {
    const f = fixture();
    if (kind === "missing") {
      f.env.DATABASE_PATH = join(dirname(f.path), "absent.sqlite");
    } else {
      f.client.exec("DROP TABLE ingestion_jobs");
    }
    try {
      const studio = f.start("credentials");
      const url = await studioUrl(studio);
      expect((await fetch(url + "/ingestion-queue")).status).toBe(503);
      expect(
        (await fetch(url + "/api/workflows/catalog-ingestion")).status,
      ).toBe(200);
      if (kind === "missing") {
        expect(existsSync(f.env.DATABASE_PATH)).toBe(false);
      }
      expect(studio.stderr()).not.toContain(f.env.DATABASE_PATH);
      studio.child.kill("SIGTERM");
      expect(await studio.exited).toBe(0);
    } finally {
      await f.close();
    }
  },
  30000,
);

test("a queue storage failure stops processing and reports unavailable", async () => {
  const f = fixture();
  cancelPendingJobs(f.client, f.batchId);
  try {
    const studio = f.start("finish");
    const url = await studioUrl(studio);
    expect((await fetch(url + "/ingestion-queue")).status).toBe(200);
    f.client.exec("DROP TABLE ingestion_jobs");
    await expect
      .poll(async () => (await fetch(url + "/ingestion-queue")).status, {
        timeout: 5000,
      })
      .toBe(503);
    expect(
      f.client.prepare("SELECT count(*) FROM ingestion_runs").pluck().get(),
    ).toBe(0);
    studio.child.kill("SIGTERM");
    expect(await studio.exited).toBe(0);
  } finally {
    await f.close();
  }
}, 30000);
