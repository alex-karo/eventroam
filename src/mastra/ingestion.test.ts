import { Mastra } from "@mastra/core/mastra";
import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { afterEach, expect, test, vi } from "vitest";
import { createStudioIngestionWorkflow } from "./ingestion";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  fixtureDependencies,
  fixtureDescriptionRole,
  set,
} from "@/test/ingestion";
import { nextJob, submitJobs } from "../ingestion/jobs/store";
import { normalizeScope, type ScopeDefinition } from "../ingestion/scope";
import { queryCatalog } from "./catalog-assistant/tools/query-catalog/query";
import { RUN_SCOPE_SQL } from "@/test/catalog-sql";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Studio and queue keep custom scope in attempts and version 8 SQL reports", async () => {
  const db = testDatabase();
  const fixtures = testFixtures();
  const events = [fixtures.event(), fixtures.event()];
  for (const event of events) {
    fixtures.eventLink(event, {
      kind: "official_site",
      url: "https://example.org/",
    });
  }
  const scope: ScopeDefinition = {
    version: 1,
    tasks: [
      {
        target: "event",
        fields: ["description"],
        instruction: "Describe the event format.",
      },
      { target: "event", fields: ["shortDescription"], required: false },
    ],
  };
  const workflow = createStudioIngestionWorkflow(
    new DuckDBStore({ path: join(dirname(db.path), "unused.duckdb") }),
    async () => ({
      deps: {
        client: db.client,
        ...fixtureDependencies({
          classification: fixtureDescriptionRole({
            description: set("Researched format"),
          }),
        }),
      },
    }),
  );
  const history = createWorkflowStorage({
    path: ":memory:",
    onFailure: workflow.historyControl.recoverHistory,
  });
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage: history,
    logger: false,
  });
  try {
    const run = await workflow.createRun();
    const output = await run.start({
      inputData: {
        mode: "refresh",
        input: { eventId: events[0].id, scope },
        dryRun: false,
        republish: false,
      },
    });
    expect(output.status).toBe("success");
    submitJobs(db.client, { eventIds: [events[1].id], scope, dryRun: false });
    const job = nextJob(db.client)!;
    expect(
      await workflow.executeJob(job, new AbortController().signal),
    ).toEqual({ failed: false });
    const attempts = db.client
      .prepare(
        "SELECT id, job_id, input_json, report_json FROM ingestion_runs ORDER BY rowid",
      )
      .all() as {
      id: string;
      job_id: string | null;
      input_json: string;
      report_json: string;
    }[];
    expect(attempts.map(({ job_id }) => job_id)).toEqual([null, job.id]);
    for (const attempt of attempts) {
      expect(JSON.parse(attempt.input_json)).toMatchObject({
        scope,
        normalizedScope: normalizeScope(scope),
        dryRun: false,
        republish: false,
      });
      expect(JSON.parse(attempt.report_json)).toMatchObject({
        schemaVersion: 8,
        outcome: "updated",
      });
      const report = queryCatalog(db.path, {
        sql: RUN_SCOPE_SQL,
        parameters: [attempt.id],
      });
      expect(report.ok).toBe(true);
      if (report.ok) {
        expect(
          JSON.parse(
            report.rows[0][report.columns.indexOf("normalizedScope")] as string,
          ),
        ).toEqual(normalizeScope(scope));
      }
    }
    for (const event of events) {
      expect(
        db.client
          .prepare("SELECT description FROM events WHERE id=?")
          .pluck()
          .get(event.id),
      ).toBe("Researched format");
    }
  } finally {
    await host.shutdown();
  }
});

test("graph inspection is lazy and execution never creates a missing catalog", async () => {
  const directory = mkdtempSync(join(tmpdir(), "eventroam-studio-lazy-"));
  directories.push(directory);
  const catalog = join(directory, "missing.sqlite");
  vi.stubEnv("DATABASE_PATH", catalog);
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const store = new DuckDBStore({
    path: join(directory, "observability.duckdb"),
  });
  const workflow = createStudioIngestionWorkflow(store);
  const history = createWorkflowStorage({
    path: ":memory:",
    onFailure: workflow.historyControl.recoverHistory,
  });
  new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage: history,
    logger: false,
  });
  expect(Object.keys(workflow.steps)).toEqual([
    "initialize-run",
    "load-context",
    "read-initial-source",
    "collect-sources",
    "general-facts",
    "tickets",
    "classification",
    "location",
    "links",
    "assemble-proposals",
    "review-proposals",
    "prepare-catalog-plan",
    "apply-catalog-item",
    "build-report",
    "finalize-run",
  ]);
  expect(existsSync(catalog)).toBe(false);
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
  const run = await workflow.createRun();
  await expect(
    run.start({
      inputData: {
        mode: "add",
        input: "Fixture",
        dryRun: true,
        republish: false,
      },
    }),
  ).rejects.toThrow("Ingestion workflow failed");
  expect(existsSync(catalog)).toBe(false);
  await history.close();
});
