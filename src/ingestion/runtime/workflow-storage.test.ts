import { expect, test } from "vitest";
import { dirname, join } from "node:path";
import { linkSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { testDatabase } from "@/test/database";
import {
  createWorkflowStorage,
  WorkflowHistoryError,
} from "./workflow-storage";
import { diagnosticStoragePaths } from "./storage-paths";
import type { WorkflowRunState } from "@mastra/core/workflows";

export function pendingSnapshot(runId: string): WorkflowRunState {
  return {
    runId,
    status: "pending",
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    waitingPaths: {},
    resumeLabels: {},
    timestamp: Date.now(),
    serializedStepGraph: [],
  };
}

test("the pinned native adapter saves, closes and reopens only workflow tables", async () => {
  const path = join(dirname(testDatabase().path), "workflows.sqlite");
  let storage = createWorkflowStorage({ path });
  await storage.init();
  expect(await storage.getStore("observability")).toBeUndefined();
  expect(await storage.getStore("memory")).toBeUndefined();
  const snapshot = pendingSnapshot("saved-run");
  await (await storage.getStore("workflows"))!.persistWorkflowSnapshot({
    workflowName: "catalog-ingestion",
    runId: snapshot.runId,
    snapshot,
  });
  await storage.close();
  storage = createWorkflowStorage({ path });
  try {
    await storage.init();
    const workflows = (await storage.getStore("workflows"))!;
    expect(
      await workflows.loadWorkflowSnapshot({
        workflowName: "catalog-ingestion",
        runId: snapshot.runId,
      }),
    ).toEqual(snapshot);
    expect(
      (await workflows.listWorkflowRuns({ workflowName: "catalog-ingestion" }))
        .runs,
    ).toHaveLength(1);
    const client = new Database(path, { readonly: true });
    try {
      const tables = client
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all();
      expect(tables).toEqual([
        { name: "mastra_workflow_run_owners" },
        { name: "mastra_workflow_snapshot" },
      ]);
    } finally {
      client.close();
    }
  } finally {
    await storage.close();
  }
});

test("diagnostic preflight resolves relative paths and rejects sidecars and aliases before writes", () => {
  const catalog = testDatabase().path;
  const root = dirname(catalog);
  const workflow = join(root, "workflows.sqlite");
  const observability = join(root, "observability.duckdb");
  const chat = join(root, "chat.sqlite");
  const env = {
    ...process.env,
    DATABASE_PATH: catalog,
    CATALOG_WORKFLOW_DATABASE_PATH: workflow,
    CATALOG_OBSERVABILITY_DATABASE_PATH: observability,
    CATALOG_CHAT_DATABASE_PATH: chat,
  };
  expect(
    diagnosticStoragePaths(
      { ...env, CATALOG_WORKFLOW_DATABASE_PATH: "workflows.sqlite" },
      root,
    ).workflow,
  ).toBe(workflow);
  const before = readFileSync(catalog);
  const symbolic = join(root, "symbolic");
  const hard = join(root, "hard");
  symlinkSync(catalog, symbolic);
  linkSync(catalog, hard);
  for (const path of [
    catalog,
    `${catalog}-wal`,
    `${catalog}-shm`,
    `${catalog}-journal`,
    symbolic,
    hard,
    observability,
    `${observability}.wal`,
    chat,
    `${chat}-wal`,
    `${chat}-shm`,
    `${chat}-journal`,
  ]) {
    expect(() =>
      diagnosticStoragePaths(
        { ...env, CATALOG_WORKFLOW_DATABASE_PATH: path },
        root,
      ),
    ).toThrow("separate");
  }
  writeFileSync(workflow, "history sentinel");
  const report = join(root, "report.json");
  linkSync(workflow, report);
  expect(() => diagnosticStoragePaths(env, root, [report])).toThrow("separate");
  expect(readFileSync(catalog)).toEqual(before);
  expect(readFileSync(workflow, "utf8")).toBe("history sentinel");
});

test("provider initialization errors are content-free", async () => {
  const storage = createWorkflowStorage({ path: ":memory:" });
  const workflows = (await storage.getStore("workflows"))!;
  workflows.init = async () => {
    throw new Error("PRIVATE_DATABASE_PATH");
  };
  try {
    await expect(storage.init()).rejects.toThrow(WorkflowHistoryError);
  } finally {
    await storage.close();
  }
});
