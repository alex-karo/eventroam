import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { __hookHandlerCount } from "@mastra/core/hooks";
import { createCatalogIngestionWorkflow, runCatalogResearch } from "./workflow";
import {
  createWorkflowStorage,
  WorkflowHistoryError,
} from "./runtime/workflow-storage";
import { executeCatalogCommand } from "../../commands/catalog";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import {
  generateFixtureEditor,
  generateFixtureLocation,
  createFixtureIngestionWorkflow,
} from "@/test/ingestion";
import { closeFixtureWorkflowStores } from "@/test/workflow-stores";

function fixture() {
  const database = testDatabase();
  const event = testFixtures().event();
  const path = join(dirname(database.path), "workflows.sqlite");
  const deps = {
    client: database.client,
    generateEditor: generateFixtureEditor,
    generateLocation: generateFixtureLocation,
    generateCandidate: vi.fn(async () => ({
      status: "success",
      errors: [],
      unresolved: [],
      data: {
        eventId: event.id,
        eventName: event.canonicalName,
        summary: { value: "ALLOWED_MODEL_TEXT", reason: "Official source" },
        sources: [],
        links: { socials: {} },
        previousEdition: null,
        currentOrNextEdition: null,
      },
    })),
  };
  return {
    database,
    event,
    path,
    deps,
    input: {
      mode: "refresh" as const,
      eventId: event.id,
      actor: "catalog-research",
      dryRun: false,
    },
  };
}

test.each([false, true])(
  "injected storage stays open while host hooks are released (history failure: %s)",
  async (historyFailure) => {
    const f = fixture();
    const storage = createWorkflowStorage({ path: ":memory:" });
    const close = vi.spyOn(storage, "close");
    const before = __hookHandlerCount("onScorerRun");
    try {
      if (historyFailure) {
        const domain = (await storage.getStore("workflows"))!;
        vi.spyOn(domain, "persistWorkflowSnapshot").mockRejectedValue(
          new WorkflowHistoryError(),
        );
      }
      const result = runCatalogResearch(f.input, {
        ...f.deps,
        workflowStorage: storage,
      });
      if (historyFailure) {
        await expect(result).rejects.toBeInstanceOf(WorkflowHistoryError);
      } else {
        await result;
      }
      expect(__hookHandlerCount("onScorerRun")).toBe(before);
      expect(close).not.toHaveBeenCalled();
      expect(
        await (await storage.getStore("workflows"))!.listWorkflowRuns({
          workflowName: "catalog-ingestion",
        }),
      ).toBeDefined();
    } finally {
      await storage.close();
    }
  },
);

test("fixture cleanup releases its Mastra host hooks", async () => {
  const before = __hookHandlerCount("onScorerRun");
  createFixtureIngestionWorkflow(async () => ({ deps: fixture().deps }));
  expect(__hookHandlerCount("onScorerRun")).toBe(before + 1);
  await closeFixtureWorkflowStores();
  expect(__hookHandlerCount("onScorerRun")).toBe(before);
});

function failWrites(path: string, condition: string) {
  const client = new Database(path);
  client.exec(
    `CREATE TRIGGER fail_history BEFORE INSERT ON mastra_workflow_snapshot WHEN ${condition} BEGIN SELECT RAISE(FAIL, 'PRIVATE_HISTORY_ERROR'); END`,
  );
  client.close();
}

// These predicates select actual write boundaries, not a write-count assumption.
test.each([
  [
    "before work",
    "json_extract(NEW.snapshot, '$.status') = 'pending'",
    false,
    false,
  ],
  [
    "start transition",
    "json_extract(NEW.snapshot, '$.status') = 'running'",
    false,
    false,
  ],
  [
    "between steps",
    "json_extract(NEW.snapshot, '$.context.\"load-context\".status') = 'success'",
    false,
    true,
  ],
  [
    "after apply",
    "json_extract(NEW.snapshot, '$.value.data.applied') IS NOT NULL",
    true,
    true,
  ],
  [
    "after report",
    "json_extract(NEW.snapshot, '$.context.\"finalize-run\".status') = 'success'",
    true,
    true,
  ],
] as const)(
  "required history failure %s preserves confirmed work and safe CLI output",
  async (_stage, condition, applied, attempted) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = fixture();
    vi.stubEnv("CATALOG_WORKFLOW_DATABASE_PATH", f.path);
    const storage = createWorkflowStorage({ path: f.path });
    await storage.init();
    failWrites(f.path, condition);
    const stdout = vi.fn();
    try {
      expect(
        await executeCatalogCommand(
          [
            "refresh",
            "--event",
            f.event.id,
            "--database",
            f.database.path,
            "--apply",
            "--json",
          ],
          {
            stdout,
            researchDependencies: { ...f.deps, workflowStorage: storage },
          },
        ),
      ).toBe(1);
      const output = stdout.mock.calls[0][0] as string;
      const report = JSON.parse(output);
      expect(output).not.toContain("PRIVATE_HISTORY_ERROR");
      expect(JSON.stringify(errors.mock.calls)).not.toContain(
        "PRIVATE_HISTORY_ERROR",
      );
      expect(report.failures[0].code).toBe("workflow_history_failed");
      expect(
        f.database.client
          .prepare("SELECT summary FROM events WHERE id=?")
          .get(f.event.id),
      ).toEqual({ summary: applied ? "ALLOWED_MODEL_TEXT" : null });
      const rows = f.database.client
        .prepare("SELECT * FROM ingestion_runs")
        .all() as { status: string; report_json: string }[];
      expect(rows).toHaveLength(attempted ? 1 : 0);
      if (attempted) {
        expect(rows[0].status).not.toBe("running");
        expect(JSON.parse(rows[0].report_json)).toEqual(report.results[0]);
      }
      if (!applied) {
        expect(f.deps.generateCandidate).not.toHaveBeenCalled();
      }
    } finally {
      await storage.close();
      errors.mockRestore();
    }
  },
);

test("native snapshots retain input, IDs and model text while dropping separate request context", async () => {
  const f = fixture();
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: f.deps,
  }));
  const storage = createWorkflowStorage({
    path: f.path,
    onFailure: workflow.historyControl.recoverHistory,
  });
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  try {
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        mode: "refresh",
        eventId: f.event.id,
      } as never,
      requestContext: new RequestContext([
        [
          "private",
          {
            credentials: "PRIVATE_CREDENTIAL",
            prompt: "PRIVATE_PROMPT",
            body: "PRIVATE_BODY",
            url: "https://user:pass@example.org/PRIVATE_URL",
            error: "PRIVATE_EXCEPTION",
          },
        ],
      ]),
    });
    expect(result.status).toBe("success");
    const domain = (await storage.getStore("workflows"))!;
    const snapshot = await domain.loadWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
    });
    expect(snapshot?.requestContext).toBeUndefined();
    expect(snapshot?.context.input).toMatchObject({
      dryRun: true,
      republish: false,
    });
    expect(snapshot?.context["initialize-run"]).toMatchObject({
      status: "success",
      output: { engineRunId: run.runId, ingestionRunId: expect.any(String) },
    });
    expect(JSON.stringify(snapshot)).toContain("ALLOWED_MODEL_TEXT");
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_");
  } finally {
    await host.shutdown();
  }
});

test("reopened started IDs never allocate another attempt or change history", async () => {
  const f = fixture();
  let storage = createWorkflowStorage({ path: f.path });
  await runCatalogResearch(f.input, { ...f.deps, workflowStorage: storage });
  const domain = (await storage.getStore("workflows"))!;
  const entries = (
    await domain.listWorkflowRuns({ workflowName: "catalog-ingestion" })
  ).runs;
  const id = entries[0].runId;
  const before = await domain.loadWorkflowSnapshot({
    workflowName: "catalog-ingestion",
    runId: id,
  });
  await storage.close();
  storage = createWorkflowStorage({ path: f.path });
  const resolver = vi.fn(async () => ({ deps: f.deps }));
  const workflow = createCatalogIngestionWorkflow(resolver);
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  try {
    const run = await workflow.createRun({ runId: id });
    await run
      .start({
        inputData: {
          mode: "refresh",
          eventId: f.event.id,
          dryRun: true,
          republish: false,
        },
      })
      .catch(() => undefined);
    expect(resolver).not.toHaveBeenCalled();
    expect(
      f.database.client.prepare("SELECT * FROM ingestion_runs").all(),
    ).toHaveLength(1);
    expect(
      await (await storage.getStore("workflows"))!.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: id,
      }),
    ).toEqual(before);
  } finally {
    await host.shutdown();
  }
});

test("a stopped start transition stays used even before attempt allocation", async () => {
  const f = fixture();
  const workflow = createCatalogIngestionWorkflow(async () => {
    throw new Error("Simulated stop before allocation");
  });
  let storage = createWorkflowStorage({ path: f.path });
  let host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  const run = await workflow.createRun();
  await expect(
    run.start({
      inputData: {
        mode: "refresh",
        eventId: f.event.id,
        dryRun: true,
        republish: false,
      },
    }),
  ).rejects.toThrow("Ingestion workflow failed");
  await host.shutdown();
  storage = createWorkflowStorage({ path: f.path });
  const resolve = vi.fn(async () => ({ deps: f.deps }));
  const again = createCatalogIngestionWorkflow(resolve);
  host = new Mastra({
    workflows: { "catalog-ingestion": again },
    storage,
    logger: false,
  });
  try {
    await again.historyControl
      .assertCanStart((await storage.getStore("workflows"))!, run.runId)
      .catch((error) => expect(error.message).toContain("already started"));
    const old = await again.createRun({ runId: run.runId });
    await old
      .start({
        inputData: {
          mode: "refresh",
          eventId: f.event.id,
          dryRun: true,
          republish: false,
        },
      })
      .catch(() => undefined);
    expect(resolve).not.toHaveBeenCalled();
    expect(
      f.database.client.prepare("SELECT * FROM ingestion_runs").all(),
    ).toEqual([]);
  } finally {
    await host.shutdown();
  }
});

test("a real CLI report collision is rejected before either file changes", async () => {
  const f = fixture();
  vi.stubEnv("CATALOG_WORKFLOW_DATABASE_PATH", f.path);
  writeFileSync(f.path, "history sentinel");
  const before = readFileSync(f.database.path);
  await expect(
    executeCatalogCommand(
      [
        "refresh",
        "--event",
        f.event.id,
        "--database",
        f.database.path,
        "--report",
        f.path,
      ],
      { stdout: vi.fn(), researchDependencies: f.deps },
    ),
  ).rejects.toThrow("separate");
  expect(readFileSync(f.path, "utf8")).toBe("history sentinel");
  expect(readFileSync(f.database.path)).toEqual(before);
  expect(f.deps.generateCandidate).not.toHaveBeenCalled();
});

test("deleting a completed native run preserves catalog audit and reports", async () => {
  const f = fixture();
  const storage = createWorkflowStorage({ path: f.path });
  try {
    const report = await runCatalogResearch(f.input, {
      ...f.deps,
      workflowStorage: storage,
    });
    const read = () => [
      f.database.client.prepare("SELECT * FROM events").all(),
      f.database.client.prepare("SELECT * FROM catalog_changes").all(),
      f.database.client.prepare("SELECT * FROM ingestion_runs").all(),
    ];
    const before = read();
    const domain = (await storage.getStore("workflows"))!;
    const entries = (
      await domain.listWorkflowRuns({ workflowName: "catalog-ingestion" })
    ).runs;
    await domain.deleteWorkflowRunById({
      workflowName: "catalog-ingestion",
      runId: entries[0].runId,
    });
    expect((await domain.listWorkflowRuns()).runs).toEqual([]);
    expect(read()).toEqual(before);
    expect(JSON.stringify(before)).toContain(report.runId);
  } finally {
    await storage.close();
  }
});

test("invalid native input starts no durable attempt and does not open owner storage", async () => {
  const f = fixture();
  const resolve = vi.fn(async () => ({ deps: f.deps }));
  const workflow = createCatalogIngestionWorkflow(resolve);
  const storage = createWorkflowStorage({ path: ":memory:" });
  const host = new Mastra({
    workflows: { "catalog-ingestion": workflow },
    storage,
    logger: false,
  });
  try {
    const run = await workflow.createRun();
    await expect(
      run.start({ inputData: { mode: "refresh" } as never }),
    ).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
    expect(
      f.database.client.prepare("SELECT * FROM ingestion_runs").all(),
    ).toEqual([]);
    expect(existsSync(f.path)).toBe(false);
  } finally {
    await host.shutdown();
  }
});

test.each(["first later snapshot", "start acknowledgment"] as const)(
  "%s failure keeps a saved start used after reopening",
  async (boundary) => {
    const f = fixture();
    const close = vi.fn();
    const resolve = vi.fn(async () => ({ deps: f.deps, close }));
    const workflow = createCatalogIngestionWorkflow(resolve);
    let storage = createWorkflowStorage({
      path: f.path,
      onFailure: workflow.historyControl.recoverHistory,
    });
    await storage.init();
    const domain = (await storage.getStore("workflows"))!;
    const persist = domain.persistWorkflowSnapshot.bind(domain);
    domain.persistWorkflowSnapshot = async (args) => {
      if (
        boundary === "first later snapshot" &&
        (args.snapshot.value as { data?: unknown })?.data
      ) {
        await workflow.historyControl.recoverHistory(args.runId);
        throw new WorkflowHistoryError(args.runId);
      }
      await persist(args);
      if (
        boundary === "start acknowledgment" &&
        args.snapshot.status === "running"
      ) {
        throw new WorkflowHistoryError(args.runId);
      }
    };
    let host = new Mastra({
      workflows: { "catalog-ingestion": workflow },
      storage,
      logger: false,
    });
    const run = await workflow.createRun();
    const failure = await run
      .start({
        inputData: {
          mode: "refresh",
          eventId: f.event.id,
          dryRun: true,
          republish: false,
        },
      })
      .catch((error: unknown) => error);
    expect(
      failure instanceof Error ? failure.message : JSON.stringify(failure),
    ).toContain("workflow_history_failed");
    const before = await (await storage.getStore(
      "workflows",
    ))!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(before?.status).toBe("running");
    expect(close).toHaveBeenCalledTimes(
      boundary === "first later snapshot" ? 1 : 0,
    );
    const attempts = f.database.client
      .prepare("SELECT * FROM ingestion_runs")
      .all();
    expect(attempts).toHaveLength(boundary === "first later snapshot" ? 1 : 0);
    expect(f.deps.generateCandidate).not.toHaveBeenCalled();
    await host.shutdown();
    storage = createWorkflowStorage({ path: f.path });
    await storage.init();
    const reopenedResolve = vi.fn(async () => ({ deps: f.deps }));
    const reopened = createCatalogIngestionWorkflow(reopenedResolve);
    host = new Mastra({
      workflows: { "catalog-ingestion": reopened },
      storage,
      logger: false,
    });
    try {
      const old = await reopened.createRun({ runId: run.runId });
      await old
        .start({
          inputData: {
            mode: "refresh",
            eventId: f.event.id,
            dryRun: true,
            republish: false,
          },
        })
        .catch(() => undefined);
      expect(reopenedResolve).not.toHaveBeenCalled();
      expect(
        f.database.client.prepare("SELECT * FROM ingestion_runs").all(),
      ).toEqual(attempts);
      expect(
        await (await storage.getStore("workflows"))!.loadWorkflowSnapshot({
          workflowName: workflow.id,
          runId: run.runId,
        }),
      ).toEqual(before);
    } finally {
      await host.shutdown();
    }
  },
);

test("CLI help and invalid syntax do not open workflow storage", async () => {
  const f = fixture();
  vi.stubEnv("CATALOG_WORKFLOW_DATABASE_PATH", f.path);
  expect(await executeCatalogCommand(["--help"], { stdout: vi.fn() })).toBe(0);
  await expect(
    executeCatalogCommand(["refresh", "--unknown"], { stdout: vi.fn() }),
  ).rejects.toThrow();
  expect(existsSync(f.path)).toBe(false);
});
