import { execFileSync, spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import {
  startStudioFixture,
  STUDIO_FIXTURE_EVENT_ID,
} from "../test/studio-fixture";
import { testFixtures } from "../test/fixtures";

const workflowUrl = "/api/workflows/catalog-ingestion";

test("CLI exits before credential-free Studio reopens previews, batch results and interrupted steps", async () => {
  const seeded = await startStudioFixture();
  await seeded.stop(true);
  try {
    const client = new Database(seeded.catalogPath);
    const second = testFixtures(client).event({
      canonicalName: "Second CLI Fixture",
      slug: "second-cli-fixture",
    });
    client.close();
    const env = {
      ...process.env,
      DATABASE_PATH: seeded.catalogPath,
      CATALOG_WORKFLOW_DATABASE_PATH: seeded.workflowPath,
      CATALOG_OBSERVABILITY_DATABASE_PATH: seeded.tracePath,
      CATALOG_LOGGING: "false",
      CATALOG_TRACING: "false",
      OPENROUTER_API_KEY: "",
    };
    const base = [
      "--import",
      "tsx",
      resolve("src/test/history-cli.ts"),
      "refresh",
      "--event",
      STUDIO_FIXTURE_EVENT_ID,
      "--database",
      seeded.catalogPath,
      "--json",
    ];
    const preview = JSON.parse(
      execFileSync(process.execPath, base, { env, encoding: "utf8" }),
    );
    expect(preview.results[0].outcome).not.toBe("failed");
    const checkPreview = new Database(seeded.catalogPath, { readonly: true });
    expect(
      checkPreview
        .prepare("SELECT summary FROM events WHERE id=?")
        .get(STUDIO_FIXTURE_EVENT_ID),
    ).toEqual({ summary: null });
    checkPreview.close();
    const batch = JSON.parse(
      execFileSync(
        process.execPath,
        [...base, "--event", second.id, "--apply"],
        {
          env,
          encoding: "utf8",
        },
      ),
    );
    expect(batch.results).toHaveLength(2);
    expect(batch.results[0].runId).not.toBe(batch.results[1].runId);
    const failure = spawnSync(process.execPath, [...base, "--fixture-failed"], {
      env,
      encoding: "utf8",
    });
    expect(failure.status).toBe(1);
    const failed = JSON.parse(failure.stdout);
    expect(failed.results[0].outcome).toBe("failed");
    const writer = spawn(process.execPath, [...base, "--fixture-interrupt"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await new Promise<void>((ready, reject) => {
        let output = "";
        const timeout = setTimeout(
          () => reject(new Error("Fixture did not enter research")),
          15_000,
        );
        writer.stdout.on("data", (chunk) => {
          output += chunk;
          if (output.includes("FIXTURE_RESEARCH_WAITING")) {
            clearTimeout(timeout);
            ready();
          }
        });
        writer.once("exit", () => {
          clearTimeout(timeout);
          reject(new Error("Fixture exited before interruption"));
        });
      });
      writer.kill("SIGKILL");
      await new Promise<void>((done) => writer.once("exit", () => done()));
    } finally {
      if (writer.exitCode === null && writer.signalCode === null) {
        writer.kill("SIGKILL");
      }
    }
    const inspected = await startStudioFixture("success", {
      directory: seeded.directory,
      inspectionOnly: true,
      catalog: false,
    });
    try {
      const entries = await (
        await fetch(`${inspected.baseUrl}${workflowUrl}/runs`)
      ).json();
      const runs = entries.runs as {
        runId: string;
        snapshot: { status: string };
      }[];
      expect(runs).toHaveLength(5);
      expect(new Set(runs.map((entry) => entry.runId)).size).toBe(5);
      const saved = await Promise.all(
        runs.map(async (entry) =>
          (
            await fetch(
              `${inspected.baseUrl}${workflowUrl}/runs/${entry.runId}`,
            )
          ).json(),
        ),
      );
      const text = JSON.stringify(saved);
      expect(text).toContain(preview.results[0].runId);
      expect(text).toContain(batch.results[0].runId);
      expect(text).toContain(batch.results[1].runId);
      expect(text).not.toContain("PRIVATE_CLI_PAGE_BODY");
      const interrupted = saved.find((entry) => entry.status === "running");
      expect(interrupted).toMatchObject({
        runId: expect.any(String),
        steps: {
          "initialize-run": {
            status: "success",
            output: {
              engineRunId: interrupted?.runId,
              ingestionRunId: expect.any(String),
            },
          },
          "load-context": { status: "success" },
        },
      });
      const durable = new Database(seeded.catalogPath, { readonly: true });
      try {
        expect(
          durable
            .prepare("SELECT id,status FROM ingestion_runs WHERE id=?")
            .get(interrupted.steps["initialize-run"].output.ingestionRunId),
        ).toEqual({
          id: interrupted.steps["initialize-run"].output.ingestionRunId,
          status: "running",
        });
      } finally {
        durable.close();
      }
      for (const entry of runs) {
        const denied = await fetch(
          `${inspected.baseUrl}${workflowUrl}/start?runId=${entry.runId}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              inputData: { mode: "refresh", eventId: STUDIO_FIXTURE_EVENT_ID },
            }),
          },
        );
        expect(denied.status).toBe(409);
      }
    } finally {
      await inspected.stop();
    }
  } finally {
    rmSync(seeded.directory, { recursive: true, force: true });
  }
}, 60_000);
