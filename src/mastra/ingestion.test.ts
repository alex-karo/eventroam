import { Mastra } from "@mastra/core/mastra";
import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBStore } from "@mastra/duckdb";
import { afterEach, expect, test, vi } from "vitest";
import { createStudioIngestionWorkflow } from "./ingestion";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
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
        name: "Fixture",
        dryRun: true,
        republish: false,
      },
    }),
  ).rejects.toThrow("Ingestion workflow failed");
  expect(existsSync(catalog)).toBe(false);
  await history.close();
});

test.each(["failed", "canceled"])(
  "job execution exposes returned %s status without private errors",
  async (status) => {
    const workflow = createStudioIngestionWorkflow(
      new DuckDBStore({ path: ":memory:" }),
    );
    const run = await workflow.createRun();
    vi.spyOn(workflow, "createRun").mockResolvedValue(run);
    // WorkflowResult omits the canceled status returned by the engine.
    vi.spyOn(run, "start").mockResolvedValue({
      status,
      input: {},
      steps: {},
      error: new Error("PRIVATE_EXECUTION_ERROR"),
    } as Awaited<ReturnType<typeof run.start>>);
    const log = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const result = await workflow.executeJob(
      {
        id: "job",
        batch_id: "batch",
        event_id: "event",
        scope: "full",
        dry_run: 1,
      } as Parameters<typeof workflow.executeJob>[0],
      new AbortController().signal,
      log,
    );
    expect(result).toEqual({
      failed: status === "failed",
    });
    expect(log[status === "failed" ? "error" : "warn"]).toHaveBeenCalledWith(
      "Ingestion job workflow ended",
      expect.objectContaining({ status }),
    );
    expect(log[status === "failed" ? "warn" : "error"]).not.toHaveBeenCalled();
    expect(
      JSON.stringify([
        ...log.info.mock.calls,
        ...log.warn.mock.calls,
        ...log.error.mock.calls,
      ]),
    ).not.toContain("PRIVATE_EXECUTION_ERROR");
  },
);
