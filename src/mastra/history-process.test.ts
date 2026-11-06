import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import {
  startStudioFixture,
  STUDIO_FIXTURE_EVENT_ID,
} from "../test/studio-fixture";

const workflowUrl = "/api/workflows/catalog-ingestion";
const cli = ["--import", "tsx", resolve("commands/catalog.ts")];

test("CLI uses Studio storage and inspection can reopen completed and interrupted runs", async () => {
  const studio = await startStudioFixture();
  try {
    const env = {
      ...process.env,
      DATABASE_PATH: resolve(studio.directory, "absent.sqlite"),
      OPENROUTER_API_KEY: "",
    };
    const base = [
      ...cli,
      "refresh",
      "--event",
      STUDIO_FIXTURE_EVENT_ID,
      "--json",
    ];
    const options = { env, encoding: "utf8" as const };
    const preview = JSON.parse(
      execFileSync(
        process.execPath,
        [...base, "--url", studio.baseUrl],
        options,
      ),
    );
    expect(preview.results[0]).toMatchObject({
      eventId: STUDIO_FIXTURE_EVENT_ID,
      dryRun: true,
      outcome: "created",
      ingestionRunId: expect.any(String),
      engineRunId: expect.any(String),
    });
    expect(preview.results[0]).not.toHaveProperty("changes");
    for (const field of [
      "savedEditionCount",
      "returnedEditionCount",
      "readCount",
      "searchCount",
      "operationCount",
      "changedCount",
    ]) {
      expect(preview.results[0]).not.toHaveProperty(field);
    }
    const catalog = new Database(studio.catalogPath, { readonly: true });
    try {
      expect(
        catalog.prepare("SELECT COUNT(*) AS count FROM editions").get(),
      ).toEqual({ count: 0 });
      expect(
        catalog
          .prepare(
            "SELECT description, short_description FROM events WHERE id=?",
          )
          .get(STUDIO_FIXTURE_EVENT_ID),
      ).toEqual({ description: null, short_description: null });
      const saved = catalog
        .prepare("SELECT status, report_json FROM ingestion_runs WHERE id=?")
        .get(preview.results[0].ingestionRunId) as {
        status: string;
        report_json: string;
      };
      expect(saved.status).toBe("completed");
      const workflow = await fetch(
        `${studio.baseUrl}${workflowUrl}/runs/${preview.results[0].engineRunId}`,
      );
      const { steps } = await workflow.json();
      expect(steps["finalize-run"].output).toEqual(preview.results[0]);
      const report = steps["build-report"].output;
      expect(report).toEqual(JSON.parse(saved.report_json));
      expect(report).toMatchObject({
        workload: {
          savedEditions: expect.any(Number),
          returnedEditions: expect.any(Number),
        },
        budget: { pages: expect.any(Number), searches: expect.any(Number) },
        operations: expect.any(Array),
        receipts: expect.any(Array),
      });
      expect(report.changes.length).toBeGreaterThan(0);
    } finally {
      catalog.close();
    }

    const unknownEvent = "00000000-0000-4000-8000-000000000099";
    const batch = spawnSync(
      process.execPath,
      [
        ...cli,
        "refresh",
        "--event",
        unknownEvent,
        "--event",
        STUDIO_FIXTURE_EVENT_ID,
        "--apply",
        "--json",
        "--url",
        studio.baseUrl,
      ],
      options,
    );
    expect(batch.status, batch.stderr).toBe(1);
    const applied = JSON.parse(batch.stdout);
    expect(applied.failures).toMatchObject([
      { eventId: unknownEvent, code: "workflow_failed" },
    ]);
    expect(applied.results).toMatchObject([
      { eventId: STUDIO_FIXTURE_EVENT_ID, dryRun: false, outcome: "created" },
    ]);
    const appliedCatalog = new Database(studio.catalogPath, { readonly: true });
    try {
      expect(
        appliedCatalog
          .prepare(
            "SELECT description, short_description FROM events WHERE id=?",
          )
          .get(STUDIO_FIXTURE_EVENT_ID),
      ).toEqual({
        description:
          "Live music takes place outdoors. The programme includes workshops. Visitors can join group activities.",
        short_description: "An outdoor music festival with workshops.",
      });
    } finally {
      appliedCatalog.close();
    }
    const completedId = applied.results[0].engineRunId;
    expect(completedId).not.toBe(preview.results[0].engineRunId);
    await studio.stop(true);

    const waiting = await startStudioFixture("cancel", {
      directory: studio.directory,
    });
    const command = spawn(
      process.execPath,
      [...base, "--url", waiting.baseUrl],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    command.stdout.setEncoding("utf8").on("data", (text) => (output += text));
    const exited = once(command, "close");
    let interruptedId: string | undefined;
    try {
      await expect
        .poll(
          async () => {
            const response = await fetch(
              `${waiting.baseUrl}${workflowUrl}/runs`,
            );
            const entries = (await response.json()).runs as {
              runId: string;
              snapshot: { status: string };
            }[];
            interruptedId = entries.find(
              (entry) => entry.snapshot.status === "running",
            )?.runId;
            if (!interruptedId) {
              return undefined;
            }
            const current = await fetch(
              `${waiting.baseUrl}${workflowUrl}/runs/${interruptedId}`,
            );
            return (await current.json()).steps?.["load-context"]?.status;
          },
          { timeout: 10_000 },
        )
        .toBe("success");
      const stopped = once(waiting.child, "exit");
      waiting.child.kill("SIGKILL");
      await stopped;
      expect(await exited).toEqual([1, null]);
      expect(JSON.parse(output).failures).toMatchObject([
        { engineRunId: interruptedId, code: "studio_outcome_unknown" },
      ]);
    } finally {
      if (command.exitCode === null && command.signalCode === null) {
        command.kill("SIGKILL");
        await exited;
      }
      await waiting.stop(true);
    }

    const inspected = await startStudioFixture("success", {
      directory: studio.directory,
      inspectionOnly: true,
      catalog: false,
    });
    try {
      for (const runId of [completedId, interruptedId]) {
        const saved = await fetch(
          `${inspected.baseUrl}${workflowUrl}/runs/${runId}`,
        );
        expect(saved.status).toBe(200);
        expect(await saved.json()).toMatchObject({
          runId,
          status: runId === interruptedId ? "running" : "success",
          steps: {
            "initialize-run": {
              status: "success",
              output: {
                engineRunId: runId,
                ingestionRunId: expect.any(String),
              },
            },
          },
        });
      }
    } finally {
      await inspected.stop();
    }
  } finally {
    await studio.stop(true);
    rmSync(studio.directory, { recursive: true, force: true });
  }
}, 60_000);
