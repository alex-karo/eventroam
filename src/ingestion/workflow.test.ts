import {
  runFixtureResearch as executeResearch,
  fixtureDependencies,
  fixtureChecks,
  fixtureRoleGenerator,
  fixtureTargets,
  fixtureTool,
  fixtureLocationPlan,
  set,
  createFixtureIngestionWorkflow,
} from "@/test/ingestion";
import { CatalogAttempt } from "./attempt";
import { createIngestionData } from "./contracts";
import * as runsModule from "./runs";
import { afterEach, expect, test, vi } from "vitest";
import { Run, Workflow } from "@mastra/core/workflows";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type Database from "better-sqlite3";
import { catalogChanges, operationReceipts } from "@/db/schema";
import {
  readResearchCatalog,
  readResearchEvent,
} from "@/catalog/read/research";
import { createTestDatabase, testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { studioIngestionInputSchema } from "./invocation";
import * as contextModule from "./research/context";
import * as prepareModule from "./catalog-plan";
import * as generalTargetsModule from "./roles/general/validate-targets";
import * as reportModule from "./report";
import * as applyModule from "@/catalog/write/apply-operation";
import * as runTraceModule from "./runtime/tracing";
import type { CatalogRunTrace } from "./runtime/tracing";
import { RunPersistenceError } from "./runs";
import { DEFAULT_RESEARCH_LIMITS } from "./runtime/budget";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Every existing outcome regression also verifies durable lifecycle and projections.
const runCatalogResearch: typeof executeResearch = async (input, deps) => {
  const result = await executeResearch(input, { ...dependencies(), ...deps });
  const row = deps.client
    .prepare("SELECT * FROM ingestion_runs WHERE id=?")
    .get(result.runId) as Record<string, unknown>;

  expect(JSON.parse(row.report_json as string)).toEqual(result);
  expect(JSON.parse(row.input_json as string).mode).toBe(input.mode);

  expect(row.finished_at).toMatch(/Z$/);
  const persistent =
    result.eventId &&
    deps.client.prepare("SELECT id FROM events WHERE id=?").get(result.eventId);
  expect(row.event_id).toBe(persistent ? result.eventId : null);
  return result;
};
import { ResearchLimitError } from "./runtime/budget";
import type { ReadPageResult } from "./tools/read-page/contracts";

const url = "https://example.org/example-fest";
const source: ReadPageResult = {
  attemptedUrl: url,
  finalUrl: url,
  retrievedAt: "2026-10-03T12:00:00Z",
  method: "http",
  status: "ok",
  markdown: "Example Fest 2027, July 1–3, Lisbon, Portugal.",
};
const reason = "The official page states this for the 2027 festival.";
const input = {
  mode: "add" as const,
  input: "Example Fest",
  actor: "catalog-research",
  initiatedBy: "fixture-owner",
};

function dependencies() {
  return {
    ...fixtureDependencies(),
    generateRole: fixtureRoleGenerator({
      classification: async (_role: unknown, raw: string) => {
        const prompt = JSON.parse(raw);
        const slot = (name: "previousEdition" | "currentOrNextEdition") =>
          prompt.targets[name]
            ? {
                classification: set({
                  eventType: "festival",
                  format: "openair",
                  topics: ["music"],
                }),
              }
            : null;
        return {
          previousEdition: slot("previousEdition"),
          currentOrNextEdition: slot("currentOrNextEdition"),
          checks: fixtureChecks(prompt.assignedChecks),
          unresolved: [],
        };
      },
    }),
    generateLocation: async (raw: string) => {
      const prompt = JSON.parse(raw);
      const output = fixtureLocationPlan(prompt);
      if (
        output.decision.status === "ready" &&
        output.decision.currentOrNextEdition
      ) {
        output.decision.currentOrNextEdition.fields.locality = {
          action: "set",
          value: "Lisbon",
          reason,
        };
        output.decision.currentOrNextEdition.fields.countryCode = {
          action: "set",
          value: "PT",
          reason,
        };
        output.decision.currentOrNextEdition.evidenceIds = ["s1-e1"];
      }
      return output;
    },
  };
}
const createCatalogIngestionWorkflow: typeof createFixtureIngestionWorkflow = (
  resolve,
  options,
) =>
  createFixtureIngestionWorkflow(async (input, engineRunId) => {
    const resolved = await resolve(input, engineRunId);
    return { ...resolved, deps: { ...dependencies(), ...resolved.deps } };
  }, options);

function fixture(client = testDatabase().client) {
  testFixtures(client).festivalTerms();
  const readPage = vi.fn(
    async (
      _url: string,
      options: {
        budget: { consumePage: () => void };
      },
    ) => {
      options.budget.consumePage();
      return source;
    },
  );
  return { client, readPage };
}

function fakeTrace() {
  const finish = vi.fn(async () => {});
  const failed = vi.fn();
  const setEventName = vi.fn();
  const trace = {
    tracing: {
      root: undefined,
      diagnose: vi.fn(),
      setEventId: vi.fn(),
      options: { metadata: {} },
    },
    finish,
    failed,
    setEventName,
  } as unknown as CatalogRunTrace;
  vi.spyOn(runTraceModule, "createCatalogRunTrace").mockResolvedValue(trace);
  return { finish, failed, setEventName };
}
function catalogState(client: Database.Database) {
  const db = drizzle(client);
  return {
    catalog: readResearchCatalog(client),
    audit: db
      .select()
      .from(catalogChanges)
      .orderBy(asc(catalogChanges.id))
      .all(),
    receipts: db
      .select()
      .from(operationReceipts)
      .orderBy(asc(operationReceipts.operationKey))
      .all(),
  };
}

test("running row and safe normalized invocation precede context and model work", async () => {
  const { client } = fixture();
  const original = contextModule.loadResearchContext;
  const context = vi
    .spyOn(contextModule, "loadResearchContext")
    .mockImplementation((client, input) => {
      const row = client
        .prepare("SELECT * FROM ingestion_runs")
        .get() as Record<string, unknown>;
      expect(row).toMatchObject({
        status: "running",
        mode: "add",
        report_json: null,
      });
      expect(JSON.parse(row.input_json as string)).toMatchObject({
        mode: "add",
        dryRun: true,
        republish: false,
        model: "fixture",
        limits: { ...DEFAULT_RESEARCH_LIMITS, agentSteps: 3 },
        actor: "cli-owner",
        initiatedBy: "cli-request",
      });
      expect(input).toMatchObject({
        actor: "cli-owner",
        limits: { agentSteps: 3 },
        initiatedBy: "cli-request",
      });
      return original(client, input);
    });
  await runCatalogResearch(
    {
      ...input,
      actor: "cli-owner",
      limits: { agentSteps: 3 },
      initiatedBy: "cli-request",
    },
    {
      client,
      ...dependencies(),
      generateRoles: {
        general: async (_role: unknown, prompt: string) => {
          const row = client
            .prepare("SELECT id,status FROM ingestion_runs")
            .get() as { id: string; status: string };
          expect(row.status).toBe("running");
          expect(prompt).not.toContain(row.id);
          return fixtureTargets();
        },
      },
    },
  );
  expect(context).toHaveBeenCalled();
});

test.each([
  { ...input, mode: "future" },
  { ...input, mode: "check", eventId: "event" },
  { ...input, mode: "refresh", eventId: "event", scope: "next" },
  { ...input, scope: "full" },
  { ...input, input: " " },
  { ...input, actor: "" },
  { ...input, actor: "a".repeat(201) },
  { ...input, initiatedBy: "a".repeat(201) },
  { ...input, mode: "refresh", eventId: "missing" },
  { ...input, limits: { agentSteps: -1 } },
])("invalid invocation creates no run before work: %j", async (invalid) => {
  const { client, readPage } = fixture();
  const model = vi.fn();
  if (invalid.mode === "check" || "scope" in invalid) {
    expect(studioIngestionInputSchema.safeParse(invalid).success).toBe(false);
  }
  await expect(
    executeResearch(invalid as typeof input, {
      client,
      ...dependencies(),
      readPage,
      generateRoles: { general: model },
    }),
  ).rejects.toThrow();
  expect(client.prepare("SELECT * FROM ingestion_runs").all()).toEqual([]);
  expect(model).not.toHaveBeenCalled();
  expect(readPage).not.toHaveBeenCalled();
});

test("invalid config and enclosing transactions create no runs", async () => {
  const { client } = fixture();
  const model = vi.fn();
  await expect(
    executeResearch(input, {
      client,
      config: { apiKey: "secret", model: "", limits: DEFAULT_RESEARCH_LIMITS },
      ...dependencies(),
      generateRoles: { general: model },
    }),
  ).rejects.toThrow();
  client.exec("BEGIN");
  try {
    await expect(
      executeResearch(input, {
        client,
        ...dependencies(),
        generateRoles: { general: model },
      }),
    ).rejects.toThrow(/transaction/);
  } finally {
    client.exec("ROLLBACK");
  }
  expect(client.prepare("SELECT * FROM ingestion_runs").all()).toEqual([]);
  expect(model).not.toHaveBeenCalled();
});

test.each(["context", "preparation", "report"] as const)(
  "unexpected %s failure stores safe best available state",
  async (stage) => {
    const { client } = fixture();
    const secret = new Error("SECRET request body/api key");
    const model = vi.fn(async () => fixtureTargets());
    const apply = vi.spyOn(applyModule, "applyCatalogItem");
    if (stage === "context") {
      vi.spyOn(contextModule, "loadResearchContext").mockImplementationOnce(
        () => {
          throw secret;
        },
      );
    }
    if (stage === "preparation") {
      vi.spyOn(generalTargetsModule, "validateGeneral").mockImplementationOnce(
        () => {
          throw secret;
        },
      );
    }
    if (stage === "report") {
      vi.spyOn(reportModule, "buildResearchReport").mockImplementationOnce(
        () => {
          throw secret;
        },
      );
    }
    const result = await runCatalogResearch(
      { ...input, dryRun: false },
      { client, ...dependencies(), generateRoles: { general: model } },
    );
    expect(result.errors).toContainEqual({
      code: "workflow_failed",
      stage: "workflow",
      message: "Ingestion workflow failed",
    });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    if (stage === "report") {
      expect(model).toHaveBeenCalledOnce();
      expect(apply).toHaveBeenCalledOnce();
      expect(result.outcome).toBe("published");
      expect(result.receipts.length).toBeGreaterThan(0);
      expect(readResearchCatalog(client)).toHaveLength(1);
    } else {
      expect(result.outcome).toBe("failed");
      expect(readResearchCatalog(client)).toEqual([]);
      expect(result.researchStatus).toBe(
        stage === "context" ? "failed" : "partial",
      );
    }
  },
);

test("start-write failure prevents context, external work and catalog writes", async () => {
  const { client } = fixture();
  client.exec(
    "CREATE TRIGGER refuse_run BEFORE INSERT ON ingestion_runs BEGIN SELECT RAISE(ABORT, 'SECRET'); END",
  );
  const context = vi.spyOn(contextModule, "loadResearchContext");
  const model = vi.fn();
  await expect(
    executeResearch(input, {
      client,
      ...dependencies(),
      generateRoles: { general: model },
    }),
  ).rejects.toThrow(RunPersistenceError);
  expect(context).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  expect(client.prepare("SELECT * FROM ingestion_runs").all()).toEqual([]);
});

test.each(["update", "serialization"] as const)(
  "%s finalization failure preserves commit, known report and a fresh later attempt",
  async (failure) => {
    const { client } = fixture();
    if (failure === "update") {
      client.exec(
        "CREATE TRIGGER refuse_finish BEFORE UPDATE ON ingestion_runs BEGIN SELECT RAISE(ABORT, 'SECRET'); END",
      );
    }
    if (failure === "serialization") {
      const original = reportModule.buildResearchReport;
      vi.spyOn(reportModule, "buildResearchReport").mockImplementationOnce(
        (input) => {
          const report = original(input);
          const object: Record<string, unknown> = {};
          object.self = object;
          report.modelResponse = { text: null, object };
          return report;
        },
      );
    }
    const model = vi.fn(async () => fixtureTargets());
    const error = await executeResearch(
      { ...input, dryRun: false },
      { client, ...dependencies(), generateRoles: { general: model } },
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(RunPersistenceError);
    const persistence = error as RunPersistenceError;
    expect(persistence.report?.outcome).toBe("published");
    expect(persistence.report?.receipts.length).toBeGreaterThan(0);
    expect(persistence.message).not.toContain("SECRET");
    expect(model).toHaveBeenCalledOnce();
    const unfinished = client
      .prepare("SELECT * FROM ingestion_runs WHERE id=?")
      .get(persistence.runId);
    expect(unfinished).toMatchObject({
      status: "running",
      finished_at: null,
      event_id: null,
      report_json: null,
    });
    expect(readResearchCatalog(client)).toHaveLength(1);
    if (failure === "update") {
      client.exec("DROP TRIGGER refuse_finish");
    }
    const duplicateOutput = {
      decision: "duplicate",
      eventId: readResearchCatalog(client)[0].id,
      observedEventName: "Example Fest",
      reason,
      evidenceIds: ["s1-e1"],
    };
    const fresh = await runCatalogResearch(input, {
      client,
      ...dependencies(),
      generateRoles: { general: async () => duplicateOutput },
    });
    expect(fresh.runId).not.toBe(persistence.runId);
    expect(fresh.outcome).toBe("skipped");
    expect(
      client
        .prepare("SELECT * FROM ingestion_runs WHERE id=?")
        .get(persistence.runId),
    ).toEqual(unfinished);
  },
);

test.each(["refresh"] as const)(
  "%s starts associated before source/model work and retains dry-run history",
  async (mode) => {
    const { client } = fixture();
    const event = testFixtures(client).event();
    const result = await runCatalogResearch(
      { mode, eventId: event.id, actor: "owner" },
      {
        client,
        ...dependencies(),
        generateRoles: {
          general: async () => {
            expect(
              client
                .prepare("SELECT event_id,mode,status FROM ingestion_runs")
                .get(),
            ).toEqual({ event_id: event.id, mode, status: "running" });
            return {
              decision: "uncertain",
              reason: "No supported identity",
              unresolved: [],
            };
          },
        },
      },
    );
    expect(result.eventId).toBe(event.id);
  },
);

test("tracing-enabled injected workflow stores a durable run without trace storage", async () => {
  const { client } = fixture();
  const path = join(dirname(testDatabase().path), "traces.sqlite");
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", path);
  await runCatalogResearch(input, {
    client,
    ...dependencies(),
    generateRoles: { general: async () => fixtureTargets() },
  });
  expect(existsSync(path)).toBe(false);
});

test("an unexpected phase failure skips later work and returns a safe failed summary", async () => {
  const { client } = fixture();
  const trace = fakeTrace();
  const created = vi.spyOn(Workflow.prototype, "createRun");
  const starts = vi.spyOn(Run.prototype, "start");
  const loadContext = vi
    .spyOn(contextModule, "loadResearchContext")
    .mockImplementationOnce(() => {
      throw new Error("PRIVATE_CONTEXT_FAILURE");
    });
  const model = vi.fn(async () => fixtureTargets());

  const result = await runCatalogResearch(input, {
    client,
    ...dependencies(),
    generateRoles: { general: model },
  });

  expect(created).toHaveBeenCalledOnce();
  expect(starts).toHaveBeenCalledOnce();
  const engineResult = (await starts.mock.results[0].value) as {
    status: string;
    result: { errorCodes: string[]; outcome: string };
    steps: Record<string, { status: string }>;
  };
  expect(engineResult.status).toBe("success");
  expect(engineResult.steps["load-context"].status).toBe("success");
  expect(engineResult.result).toMatchObject({
    outcome: "failed",
    errorCodes: ["workflow_failed"],
  });
  expect(JSON.stringify(engineResult)).not.toContain("PRIVATE_CONTEXT_FAILURE");
  expect(model).not.toHaveBeenCalled();
  expect(loadContext).toHaveBeenCalledOnce();
  expect(result).toMatchObject({ outcome: "failed", researchStatus: "failed" });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "workflow_failed", stage: "workflow" }),
  );
  expect(JSON.stringify(result)).not.toContain("PRIVATE_CONTEXT_FAILURE");
  expect(client.prepare("SELECT id FROM ingestion_runs").all()).toHaveLength(1);
  expect(trace.failed).toHaveBeenCalledWith("workflow_failed");
  expect(trace.finish).toHaveBeenCalledOnce();
});

test("Mastra run creation failure allocates no durable attempt or resources", async () => {
  const { client, readPage } = fixture();
  const initializeTrace = vi.spyOn(runTraceModule, "createCatalogRunTrace");
  const created = vi
    .spyOn(Workflow.prototype, "createRun")
    .mockRejectedValueOnce(new Error("PRIVATE_MASTRA_SETUP"));
  const model = vi.fn(async () => fixtureTargets());

  await expect(
    executeResearch(input, {
      client,
      ...dependencies(),
      readPage,
      generateRoles: { general: model },
    }),
  ).rejects.toThrow("Ingestion workflow failed");

  expect(created).toHaveBeenCalledOnce();
  expect(model).not.toHaveBeenCalled();
  expect(readPage).not.toHaveBeenCalled();
  expect(initializeTrace).not.toHaveBeenCalled();
  expect(client.prepare("SELECT id FROM ingestion_runs").all()).toEqual([]);
});

test("CLI initialization failure finalizes its admitted attempt with a safe full report", async () => {
  const { client, readPage } = fixture();
  const model = vi.fn();
  vi.spyOn(runTraceModule, "createCatalogRunTrace").mockRejectedValueOnce(
    new Error("PRIVATE_TRACE_SETUP"),
  );

  const result = await runCatalogResearch(input, {
    client,
    ...dependencies(),
    readPage,
    generateRoles: { general: model },
  });

  expect(result).toMatchObject({ outcome: "failed", researchStatus: "failed" });
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "workflow_failed" }),
  );
  expect(JSON.stringify(result)).not.toContain("PRIVATE_TRACE_SETUP");
  expect(readPage).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  const rows = client
    .prepare("SELECT id,status,report_json FROM ingestion_runs")
    .all() as { id: string; status: string; report_json: string }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: result.runId, status: "failed" });
  expect(JSON.parse(rows[0].report_json)).toEqual(result);
});

test("overlapping Mastra runs keep their database and research state separate", async () => {
  const first = fixture();
  const second = fixture(createTestDatabase().client);
  const created = vi.spyOn(Workflow.prototype, "createRun");
  let entered = 0;
  let release!: () => void;
  const bothEntered = new Promise<void>((resolve) => {
    release = resolve;
  });
  const generator = (name: string) => async () => {
    entered += 1;
    if (entered === 2) {
      release();
    }
    await bothEntered;
    const proposal = fixtureTargets();
    proposal.observedEventName = name;
    return proposal;
  };

  const [firstResult, secondResult] = await Promise.all([
    runCatalogResearch(
      { ...input, input: "First Fest", dryRun: false },
      {
        client: first.client,
        ...dependencies(),
        generateRoles: { general: generator("First Fest") },
      },
    ),
    runCatalogResearch(
      { ...input, input: "Second Fest", dryRun: false },
      {
        client: second.client,
        ...dependencies(),
        generateRoles: { general: generator("Second Fest") },
      },
    ),
  ]);

  expect(created).toHaveBeenCalledTimes(2);
  expect(created.mock.instances[0]).not.toBe(created.mock.instances[1]);
  expect(firstResult.runId).not.toBe(secondResult.runId);
  expect(firstResult.outcome).toBe("published");
  expect(secondResult.outcome).toBe("published");
  expect(
    readResearchCatalog(first.client).map((event) => event.canonicalName),
  ).toEqual(["First Fest"]);
  expect(
    readResearchCatalog(second.client).map((event) => event.canonicalName),
  ).toEqual(["Second Fest"]);
  expect(first.client.prepare("SELECT id FROM ingestion_runs").all()).toEqual([
    { id: firstResult.runId },
  ]);
  expect(second.client.prepare("SELECT id FROM ingestion_runs").all()).toEqual([
    { id: secondResult.runId },
  ]);
});

test("one registered graph isolates overlapping previews and applies dry-run defaults", async () => {
  const first = fixture();
  const second = fixture(createTestDatabase().client);
  let entered = 0;
  let release!: () => void;
  const bothEntered = new Promise<void>((resolve) => {
    release = resolve;
  });
  const workflow = createCatalogIngestionWorkflow(async ({ input: name }) => {
    if (typeof name !== "string") {
      throw new Error("Expected an add note");
    }
    const selected = name === "First Fest" ? first : second;
    return {
      deps: {
        client: selected.client,
        ...dependencies(),
        generateRoles: {
          general: async () => {
            if (++entered === 2) {
              release();
            }
            await bothEntered;
            const proposal = fixtureTargets();
            proposal.observedEventName = name;
            return proposal;
          },
        },
      },
    };
  });
  const [firstRun, secondRun] = await Promise.all([
    workflow.createRun({ runId: "studio-first" }),
    workflow.createRun({ runId: "studio-second" }),
  ]);
  const [one, two] = await Promise.all([
    firstRun.start({
      inputData: studioIngestionInputSchema.parse({
        mode: "add",
        input: "First Fest",
      }),
    }),
    secondRun.start({
      inputData: studioIngestionInputSchema.parse({
        mode: "add",
        input: "Second Fest",
      }),
    }),
  ]);
  expect(one.status).toBe("success");
  expect(two.status).toBe("success");
  if (one.status !== "success" || two.status !== "success") {
    return;
  }
  expect(one.result).toMatchObject({
    engineRunId: "studio-first",
    dryRun: true,
    persistenceStatus: "completed",
  });
  expect(two.result).toMatchObject({
    engineRunId: "studio-second",
    dryRun: true,
    persistenceStatus: "completed",
  });
  expect(one.result.ingestionRunId).not.toBe(two.result.ingestionRunId);
  expect(readResearchCatalog(first.client)).toEqual([]);
  expect(readResearchCatalog(second.client)).toEqual([]);
});

test("duplicate active engine IDs cannot finalize the first attempt", async () => {
  const { client } = fixture();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const model = vi.fn(async () => {
    entered();
    await hold;
    return fixtureTargets();
  });
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: { client, ...dependencies(), generateRoles: { general: model } },
  }));
  const first = await workflow.createRun({ runId: "shared-engine-id" });
  const pending = first.start({
    inputData: studioIngestionInputSchema.parse({
      mode: "add",
      input: "Example Fest",
    }),
  });
  await started;
  const second = await workflow.createRun({ runId: "shared-engine-id" });
  await expect(
    second.start({
      inputData: studioIngestionInputSchema.parse({
        mode: "add",
        input: "Example Fest",
      }),
    }),
  ).rejects.toThrow();
  expect(client.prepare("SELECT status FROM ingestion_runs").all()).toEqual([
    { status: "running" },
  ]);
  release();
  const result = await pending;
  expect(result.status).toBe("success");
  expect(model).toHaveBeenCalledOnce();
  expect(client.prepare("SELECT status FROM ingestion_runs").all()).toEqual([
    { status: "completed" },
  ]);
});

test("native cancellation waits for active research before finalizing known state", async () => {
  const { client, readPage } = fixture();
  const trace = fakeTrace();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: {
      client,
      ...dependencies(),
      readPage,
      generateRoles: {
        research: async (_role, _prompt, context) => {
          await fixtureTool(context, "inspectPage", { url });
          entered();
          await hold;
          return { checks: [], unresolved: [] };
        },
      },
    },
  }));
  const run = await workflow.createRun({ runId: "cancel-research" });
  const pending = run.start({
    inputData: studioIngestionInputSchema.parse({
      mode: "add",
      input: "Example Fest",
      dryRun: false,
    }),
  });
  await started;
  const cancel = run.cancel();
  expect(client.prepare("SELECT status FROM ingestion_runs").all()).toEqual([
    { status: "running" },
  ]);
  release();
  await cancel;
  await pending;
  expect(readResearchCatalog(client)).toEqual([]);
  expect(client.prepare("SELECT status FROM ingestion_runs").all()).toEqual([
    { status: "failed" },
  ]);
  const saved = client
    .prepare("SELECT report_json FROM ingestion_runs")
    .get() as { report_json: string };
  expect(JSON.parse(saved.report_json)).toMatchObject({
    budget: { pages: 1 },
    sources: [expect.objectContaining({ attemptedUrl: url })],
  });
  expect(trace.failed).toHaveBeenCalledWith("cancelled");
  expect(trace.finish).toHaveBeenCalledOnce();
});

test("cancellation after a confirmed write preserves the committed catalog", async () => {
  const { client } = fixture();
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: {
      client,
      ...dependencies(),
      generateRoles: { general: async () => fixtureTargets() },
    },
  }));
  const run = await workflow.createRun({ runId: "cancel-after-write" });
  let cancellation: Promise<void> | undefined;
  const original = reportModule.buildResearchReport;
  vi.spyOn(reportModule, "buildResearchReport").mockImplementationOnce(
    (value) => {
      cancellation = run.cancel();
      return original(value);
    },
  );
  await run.start({
    inputData: studioIngestionInputSchema.parse({
      mode: "add",
      input: "Example Fest",
      dryRun: false,
    }),
  });
  await cancellation;
  expect(readResearchCatalog(client)).toHaveLength(1);
  const row = client
    .prepare("SELECT status,report_json FROM ingestion_runs")
    .get() as { status: string; report_json: string | null };
  expect(["completed", "failed"]).toContain(row.status);
  expect(row.report_json).not.toBeNull();
});

test("registered setup failure finalizes safely and releases its acquired connection once", async () => {
  const { client } = fixture();
  const close = vi.fn();
  vi.spyOn(runTraceModule, "createCatalogRunTrace").mockRejectedValueOnce(
    new Error("PRIVATE_TRACE_SETUP"),
  );
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: { client, ...dependencies(), generateRoles: { general: vi.fn() } },
    close,
  }));
  const run = await workflow.createRun({ runId: "failed-setup" });
  const error = await run
    .start({
      inputData: studioIngestionInputSchema.parse({
        mode: "add",
        input: "Example Fest",
      }),
    })
    .catch((reason: unknown) => reason);
  expect(String(error)).not.toContain("PRIVATE_TRACE_SETUP");
  expect(close).toHaveBeenCalledOnce();
  expect(client.prepare("SELECT status FROM ingestion_runs").all()).toEqual([
    { status: "failed" },
  ]);
});

test("registered final persistence failure exposes a bounded safe summary", async () => {
  const { client } = fixture();
  const trace = fakeTrace();
  client.exec(
    "CREATE TRIGGER refuse_finish BEFORE UPDATE ON ingestion_runs BEGIN SELECT RAISE(ABORT, 'PRIVATE_DB_ERROR'); END",
  );
  const workflow = createCatalogIngestionWorkflow(async () => ({
    deps: {
      client,
      ...dependencies(),
      generateRoles: { general: async () => fixtureTargets() },
    },
  }));
  const run = await workflow.createRun({ runId: "failed-persistence" });
  const output = run.stream({
    inputData: studioIngestionInputSchema.parse({
      mode: "add",
      input: "Maybe another gathering in 2030. Pin 38.7,-9.1",
      dryRun: false,
    }),
    outputOptions: { includeState: true },
  });
  const chunks = [];
  for await (const chunk of output.fullStream) {
    chunks.push(chunk);
  }
  const result = await output.result;
  expect(result.status).toBe("failed");
  if (result.status !== "failed") {
    return;
  }
  const row = client
    .prepare("SELECT id,status,report_json FROM ingestion_runs")
    .get() as {
    id: string;
    status: string;
    report_json: string | null;
  };
  const failure = JSON.parse(result.error?.message ?? "") as {
    code: string;
    summary: {
      engineRunId: string;
      ingestionRunId: string;
      persistenceStatus: string;
      outcome: string;
      locationStatus: string;
    };
  };
  expect(failure).toMatchObject({
    code: "run_persistence_failed",
    summary: {
      engineRunId: "failed-persistence",
      ingestionRunId: row.id,
      persistenceStatus: "failed",
      outcome: "published",
      locationStatus: "success",
    },
  });
  // Error messages are non-enumerable; JSON.stringify alone misses leaks.
  const failedStep = result.steps["finalize-run"] as { error?: Error };
  for (const error of [result.error, failedStep.error]) {
    expect(error).toBeDefined();
    expect(error?.message).not.toContain("PRIVATE_DB_ERROR");
    expect(error?.stack ?? "").not.toContain("PRIVATE_DB_ERROR");
    expect(error?.cause).toBeUndefined();
    expect(JSON.parse(error!.message)).toMatchObject(failure);
  }
  expect(JSON.stringify(result)).not.toContain("PRIVATE_DB_ERROR");
  expect(JSON.stringify(chunks)).not.toContain("PRIVATE_DB_ERROR");
  expect(row).toMatchObject({ status: "running", report_json: null });
  expect(readResearchCatalog(client)).toHaveLength(1);
  expect(trace.failed).toHaveBeenCalledWith("run_persistence_failed");
  expect(trace.setEventName).toHaveBeenCalledWith("Example Fest");
  expect(trace.finish).toHaveBeenCalledOnce();
});

test.each([false, true])(
  "concurrent and repeated finalization writes and cleans up once (failure=%s)",
  async (fails) => {
    const { client } = fixture();
    const trace = fakeTrace();
    const close = vi.fn();
    const persist = vi.spyOn(runsModule, "finalizeIngestionRun");
    const owned = new CatalogAttempt(
      "memoized-finalization",
      input,
      { client, generateRole: vi.fn() },
      close,
    );
    await owned.initialize();
    if (fails) {
      client.exec(
        "CREATE TRIGGER refuse_finish BEFORE UPDATE ON ingestion_runs BEGIN SELECT RAISE(ABORT, 'PRIVATE_PERSISTENCE'); END",
      );
    }
    const results = await Promise.allSettled([
      owned.finalize(createIngestionData()),
      owned.finalize(createIngestionData()),
    ]);
    const repeated = await owned.finalize(createIngestionData()).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(trace.finish).toHaveBeenCalledOnce();
    const first = results[0];
    if (fails && first.status === "rejected") {
      expect(first.reason).toBeInstanceOf(RunPersistenceError);
      expect((results[1] as PromiseRejectedResult).reason).toBe(first.reason);
      expect((repeated as PromiseRejectedResult).reason).toBe(first.reason);
      expect(results[1]).toEqual(first);
      expect(repeated).toEqual(first);
      expect(
        client.prepare("SELECT status,report_json FROM ingestion_runs").get(),
      ).toEqual({ status: "running", report_json: null });
    } else if (!fails && first.status === "fulfilled") {
      expect((results[1] as PromiseFulfilledResult<unknown>).value).toBe(
        first.value,
      );
      expect((repeated as PromiseFulfilledResult<unknown>).value).toBe(
        first.value,
      );
      expect(results[1]).toEqual(first);
      expect(repeated).toEqual(first);
      const row = client
        .prepare("SELECT report_json FROM ingestion_runs")
        .get() as { report_json: string };
      expect(JSON.parse(row.report_json)).toEqual(first.value);
    } else {
      throw new Error("Unexpected finalization outcome");
    }
  },
);

test.each([false, true])(
  "historical donor is checked inside the write transaction (changed=%s)",
  async (changed) => {
    const { client } = fixture();
    const fx = testFixtures(client);
    const event = fx.event({
      canonicalName: "Example Fest",
      description: "Old description",
    });
    const donor = fx.edition(event, {
      editionKey: "2026",
      editionYear: 2026,
      startsOn: "2026-07-01",
      endsOn: "2026-07-03",
      countryCode: "PT",
      latitude: 38.7,
      longitude: -9.1,
      coordinatePrecision: "approximate",
    });
    const { fixtureLocationPlan } = await import("@/test/ingestion");
    const proposal = fixtureTargets();
    proposal.eventId = event.id;
    const result = await runCatalogResearch(
      { mode: "refresh", eventId: event.id, actor: "test", dryRun: false },
      {
        client,
        ...dependencies(),
        generateRoles: { general: async () => proposal },
        generateLocation: async (raw) => {
          const prompt = JSON.parse(raw);
          const plan = fixtureLocationPlan(prompt);
          if (plan.decision.status !== "ready") {
            throw new Error("Expected ready fixture");
          }
          plan.decision.currentOrNextEdition!.coordinates = {
            action: "reusePrevious",
            reason: "Saved venue continues",
          };
          if (changed) {
            client
              .prepare(
                "UPDATE editions SET latitude=39,version=version+1 WHERE id=?",
              )
              .run(donor.id);
          }
          return plan;
        },
      },
    );
    if (changed) {
      expect(result.outcome).toBe("failed");
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "write_failed" }),
      );
      expect(readResearchEvent(client, event.id)!.description).toBe(
        "Old description",
      );
      expect(readResearchEvent(client, event.id)!.editions).toHaveLength(1);
    } else {
      expect(result.errors).toEqual([]);
      const saved = readResearchEvent(client, event.id)!.editions.find(
        (edition) => edition.editionKey === "2027",
      )!;
      expect(saved).toMatchObject({
        latitude: 38.7,
        longitude: -9.1,
        coordinatePrecision: "approximate",
      });
    }
  },
);

test.each([
  {
    name: "invalid plan",
    decision: {
      status: "ready",
      currentOrNextEdition: null,
      previousEdition: null,
    },
    status: "failed",
    error: {
      code: "location_failed",
      message: "Location target does not match the accepted slot",
    },
  },
  {
    name: "rejection",
    decision: {
      status: "rejected",
      reason: "The venue belongs to another festival",
    },
    status: "rejected",
    error: {
      code: "location_rejected",
      message: "The venue belongs to another festival",
    },
  },
  {
    name: "malformed rejection",
    decision: { status: "rejected", reason: "" },
    status: "failed",
    error: {
      code: "location_failed",
      message: "decision.reason:too_small",
    },
  },
])(
  "Location $name preserves successful Research and stops all writes",
  async ({ decision, status, error }) => {
    const prepare = vi.spyOn(prepareModule, "prepareCatalogPlan");
    const { client } = fixture();
    const result = await runCatalogResearch(
      { ...input, dryRun: false },
      {
        client,
        ...dependencies(),
        generateRoles: { general: async () => fixtureTargets() },
        generateLocation: async () => ({ decision }),
      },
    );
    expect(result.researchStatus).toBe("success");
    expect(prepare).not.toHaveBeenCalled();
    expect(result.locationStatus).toBe(status);
    expect(result.locationResponse?.object).toEqual({ decision });
    expect(result.errors).toContainEqual({ ...error, stage: "location" });
    expect(result.outcome).toBe("failed");
    expect(result.operations).toEqual([]);
    expect(result.changes).toEqual([]);
    expect(readResearchCatalog(client)).toEqual([]);
    expect(
      client
        .prepare("SELECT status FROM ingestion_runs WHERE id=?")
        .get(result.runId),
    ).toEqual({ status: "failed" });
  },
);

test("a recoverable geocoding failure and Location question permit a ticket update", async () => {
  const { client } = fixture();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  fx.edition(event, {
    editionKey: "2026",
    editionYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-03",
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate",
    countryCode: "PT",
  });
  const geocodingClient = vi.fn(async () => ({
    status: "error" as const,
    code: "provider_error" as const,
  }));
  const result = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: "test" },
    {
      client,
      generateRoles: {
        tickets: async () => ({
          currentOrNextEdition: {
            tickets: set({
              variants: [
                {
                  label: "Weekend",
                  amount: 100,
                  currency: "EUR",
                  availability: "available",
                },
              ],
              basePrice: {
                kind: "exact",
                currency: "EUR",
                minAmount: 100,
                maxAmount: 100,
                coverage: "full_programme",
              },
            }),
          },
          checks: fixtureChecks(["currentTickets"]),
          unresolved: [],
        }),
      },
      geocodingClient,
      generateLocation: async (raw) => {
        const plan = fixtureLocationPlan(JSON.parse(raw));
        if (plan.decision.status === "ready") {
          plan.decision.currentOrNextEdition!.unresolved.push({
            field: "coordinates",
            message: "Venue point remains unknown",
          });
        }
        return plan;
      },
    },
  );
  expect(geocodingClient).toHaveBeenCalledOnce();
  expect(result.errors).toEqual([]);
  expect(result.locationStatus).toBe("success");
  expect(result.unresolved).toContainEqual(
    expect.objectContaining({ field: "coordinates" }),
  );
  expect(
    result.operations.some((operation) => operation.kind === "createEdition"),
  ).toBe(true);
  expect(result.changes).toContainEqual(
    expect.objectContaining({ field: "price_min_minor", newValue: 10000 }),
  );
});

test("two accepted slots share initial geocoding and have separate Location decisions", async () => {
  const { client } = fixture();
  const prepare = vi.spyOn(prepareModule, "prepareCatalogPlan");
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const previous = fx.edition(event, {
    editionKey: "2026",
    editionYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-03",
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate",
    countryCode: "PT",
    locality: "Lisbon",
  });
  const general = fixtureTargets(event.id);
  general.previousEdition = {
    ...structuredClone(general.currentOrNextEdition!),
    editionKey: "2026",
    fields: {
      year: set(2026),
      dates: set({
        startsOn: "2026-07-01",
        endsOn: "2026-07-03",
        state: "confirmed",
      }),
    },
  };
  const geocodingClient = vi.fn<
    NonNullable<import("./contracts").ResearchDependencies["geocodingClient"]>
  >(async (request) =>
    request.direction === "forward"
      ? { status: "success", direction: "forward", candidates: [] }
      : {
          status: "success",
          direction: "reverse",
          queriedPoint: {
            latitude: request.latitude,
            longitude: request.longitude,
          },
          nearby: null,
          distanceKm: null,
        },
  );
  const generateLocation = vi.fn(async (raw: string) => {
    expect(prepare).not.toHaveBeenCalled();
    const prompt = JSON.parse(raw);
    expect(prompt.selection).not.toHaveProperty("status");
    expect(prompt.selection.previousEdition.editionKey).toBe("2026");
    expect(prompt.selection.currentOrNextEdition.editionKey).toBe("2027");
    expect(prompt.prepared).toHaveLength(1);
    expect(prompt.prepared[0].slots).toEqual([
      "previousEdition",
      "currentOrNextEdition",
    ]);
    const plan = fixtureLocationPlan(prompt);
    if (plan.decision.status !== "ready") {
      throw new Error("Expected ready fixture");
    }
    plan.decision.currentOrNextEdition!.coordinates = {
      action: "reusePrevious",
      reason: "The venue continues",
    };
    return plan;
  });
  const result = await runCatalogResearch(
    { mode: "refresh", eventId: event.id, actor: "test", dryRun: false },
    {
      client,
      generateRoles: { general: async () => general },
      geocodingClient,
      generateLocation,
    },
  );
  expect(result.errors).toEqual([]);
  expect(generateLocation).toHaveBeenCalledOnce();
  expect(prepare).toHaveBeenCalledOnce();
  expect(geocodingClient).toHaveBeenCalledOnce();
  const saved = readResearchEvent(client, event.id)!;
  expect(
    saved.editions.find((edition) => edition.id === previous.id)?.latitude,
  ).toBe(38.7);
  expect(
    saved.editions.find((edition) => edition.editionKey === "2027"),
  ).toMatchObject({
    latitude: 38.7,
    longitude: -9.1,
    coordinatePrecision: "approximate",
  });
  expect(
    result.operations.filter((operation) => operation.kind === "createEdition"),
  ).toHaveLength(1);
});

test("current Location cannot turn historical context into a write target", async () => {
  const { client } = fixture();
  const fx = testFixtures(client);
  const event = fx.event({ canonicalName: "Example Fest" });
  const previous = fx.edition(event, {
    editionKey: "2026",
    editionYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-03",
    countryCode: "PT",
    locality: "Lisbon",
  });
  const generateLocation = vi.fn(async (raw: string) => {
    const prompt = JSON.parse(raw);
    expect(prompt.previousEdition).toBeNull();
    expect(prompt.selection.previousEdition).toBeNull();
    expect(
      prompt.history.map((edition: { id: string }) => edition.id),
    ).toContain(previous.id);
    const plan = fixtureLocationPlan(prompt);
    if (plan.decision.status !== "ready") {
      throw new Error("Expected ready fixture");
    }
    plan.decision.previousEdition = {
      ...plan.decision.currentOrNextEdition!,
    };
    return plan;
  });
  const result = await runCatalogResearch(
    {
      mode: "refresh",
      eventId: event.id,
      scope: "current",
      actor: "test",
      dryRun: false,
    },
    { client, generateLocation },
  );
  expect(generateLocation).toHaveBeenCalledOnce();
  expect(result.locationStatus).toBe("failed");
  expect(result.outcome).toBe("failed");
  expect(result.operations).toEqual([]);
  expect(
    readResearchEvent(client, event.id)!.editions.map((edition) => edition.id),
  ).toEqual([previous.id]);
});

test("the public runner accumulates research in native state without runtime resources", async () => {
  const { client, readPage } = fixture();
  const created = vi.spyOn(Workflow.prototype, "createRun");
  const start = Run.prototype.start;
  const starts = vi.spyOn(Run.prototype, "start").mockImplementation(function (
    this: Run,
    options,
  ) {
    return start.call(this, {
      ...options,
      outputOptions: { includeState: true },
    });
  });
  const phases: string[] = [];
  const loadContext = contextModule.loadResearchContext;
  vi.spyOn(contextModule, "loadResearchContext").mockImplementation(
    (...args) => {
      phases.push("load-context");
      return loadContext(...args);
    },
  );
  const prepare = generalTargetsModule.validateGeneral;
  vi.spyOn(generalTargetsModule, "validateGeneral").mockImplementation(
    (...args) => {
      phases.push("validate-research");
      return prepare(...args);
    },
  );
  const prepareCatalog = prepareModule.prepareCatalogPlan;
  vi.spyOn(prepareModule, "prepareCatalogPlan").mockImplementation(
    (...args) => {
      phases.push("prepare-catalog-plan");
      return prepareCatalog(...args);
    },
  );
  const apply = applyModule.applyCatalogItem;
  vi.spyOn(applyModule, "applyCatalogItem").mockImplementation((...args) => {
    phases.push("apply-catalog-item");
    return apply(...args);
  });
  const buildReport = reportModule.buildResearchReport;
  vi.spyOn(reportModule, "buildResearchReport").mockImplementation(
    (...args) => {
      phases.push("build-report");
      return buildReport(...args);
    },
  );
  const privatePage = "PRIVATE_PAGE_BODY";
  const privateOutput = "PRIVATE_MODEL_OUTPUT";
  const proposal = fixtureTargets();
  readPage.mockImplementation(async (_url, options) => {
    options.budget.consumePage();
    return { ...source, markdown: privatePage };
  });

  const result = await runCatalogResearch(
    { ...input, dryRun: false },
    {
      client,
      config: {
        apiKey: "PRIVATE_API_KEY",
        model: "fixture",
        limits: DEFAULT_RESEARCH_LIMITS,
      },
      ...dependencies(),
      readPage,
      generateRoles: {
        classification: async (role, prompt, call) => ({
          ...((await dependencies().generateRole(
            role,
            prompt,
            call,
          )) as object),
          description: set(privateOutput),
        }),
        general: async () => {
          phases.push("research-festival");
          return proposal;
        },
      },
    },
  );

  expect(created).toHaveBeenCalledOnce();
  expect(starts).toHaveBeenCalledOnce();
  const engineResult = (await starts.mock.results[0].value) as {
    status: string;
    state: { data: import("./contracts").IngestionData };
    steps: Record<string, { output: unknown }>;
  };
  expect(engineResult.status).toBe("success");
  const workflow = created.mock.instances[0] as Workflow;
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
  expect(phases[0]).toBe("load-context");
  expect(phases.filter((phase) => phase !== "load-context")).toEqual([
    "research-festival",
    "validate-research",
    "prepare-catalog-plan",
    "apply-catalog-item",
    "build-report",
  ]);
  const graph = JSON.stringify(workflow.serializedStepGraph);
  expect(workflow.retryConfig).toMatchObject({ attempts: 0 });
  expect((workflow.options.shouldPersistSnapshot as () => boolean)()).toBe(
    true,
  );
  for (const privateValue of ["PRIVATE_API_KEY", privatePage, privateOutput]) {
    expect(graph).not.toContain(privateValue);
    expect(JSON.stringify(starts.mock.calls[0])).not.toContain(privateValue);
  }
  const stepOutput = (id: string) => engineResult.steps[id].output;
  expect(stepOutput("load-context")).toHaveProperty("catalog");
  expect(stepOutput("collect-sources")).toHaveProperty("sources");
  expect(stepOutput("collect-sources")).not.toHaveProperty("prepared");
  expect(stepOutput("location")).toHaveProperty("status", "success");
  expect(stepOutput("location")).not.toHaveProperty("operations");
  expect(stepOutput("prepare-catalog-plan")).toMatchObject({
    status: "continue",
    value: { operations: result.operations },
  });
  expect(stepOutput("apply-catalog-item")).toHaveProperty("applied");
  expect(stepOutput("build-report")).toMatchObject({ outcome: "published" });
  expect(engineResult.state.data).toMatchObject({
    research: { status: "success" },
    report: { outcome: "published" },
  });
  const { researchValidation, editorValidation, catalogPreparation } =
    engineResult.state.data;
  expect(researchValidation?.status).toBe("continue");
  expect(editorValidation?.status).toBe("continue");
  expect(catalogPreparation?.status).toBe("continue");
  if (
    researchValidation?.status !== "continue" ||
    editorValidation?.status !== "continue" ||
    catalogPreparation?.status !== "continue"
  ) {
    throw new Error("Expected all preparation stages to pass");
  }
  expect(researchValidation.value).not.toHaveProperty("editorPlan");
  expect(researchValidation.value).not.toHaveProperty("operations");
  expect(editorValidation.value).not.toHaveProperty("operations");
  expect(catalogPreparation.value.operations).toEqual(result.operations);
  expect(engineResult.state.data.outcome).toBe(result.outcome);
  expect(engineResult.state.data.reads[0]).not.toHaveProperty("markdown");
  const execution = JSON.stringify(engineResult);
  expect(execution).not.toContain('"markdown":');
  expect(execution).toContain(privateOutput);
  expect(execution).not.toContain("PRIVATE_API_KEY");
  expect(execution).not.toContain(client.name);
  expect(result.outcome).toBe("published");
  expect(result.modelResponse?.object).toMatchObject({
    observedEventName: proposal.observedEventName.trim(),
  });
});

test("dry run reports the same writes as apply and rolls back catalog, audit and receipts", async () => {
  const { client } = fixture();
  const before = catalogState(client);
  const preview = await runCatalogResearch(input, {
    client,
    ...dependencies(),
  });
  expect(preview.errors).toEqual([]);
  expect(preview.outcome).toBe("published");
  expect(preview.changes).toContainEqual(
    expect.objectContaining({ field: "starts_on", newValue: "2027-07-01" }),
  );
  expect(catalogState(client)).toEqual(before);
  expect(
    client
      .prepare("SELECT event_id FROM ingestion_runs WHERE id=?")
      .get(preview.runId),
  ).toEqual({ event_id: null });
  const applied = await runCatalogResearch(
    { ...input, dryRun: false },
    { client, ...dependencies() },
  );
  expect(applied.errors).toEqual([]);
  expect(applied.outcome).toBe("published");
  expect(applied.operations.map((op) => op.kind)).toEqual(
    preview.operations.map((op) => op.kind),
  );
  expect(
    applied.changes
      .map(({ field, newValue }) => ({ field, newValue }))
      .filter(
        ({ field }) =>
          !["created_at", "updated_at", "id", "event_id"].includes(field),
      ),
  ).toEqual(
    preview.changes
      .map(({ field, newValue }) => ({ field, newValue }))
      .filter(
        ({ field }) =>
          !["created_at", "updated_at", "id", "event_id"].includes(field),
      ),
  );
});
test.each([
  {
    status: "failed" as const,
    reasonCode: "http_503",
    code: "source_unavailable",
  },
  {
    status: "unsupported" as const,
    reasonCode: "unsupported_media_type",
    code: "source_unsupported",
  },
])(
  "source $status retains host diagnostics and cannot support identity",
  async ({ status, reasonCode, code }) => {
    const { client, readPage } = fixture();
    readPage.mockImplementation(async (_url, { budget }) => {
      budget.consumePage();
      return { ...source, status, reasonCode, markdown: "" };
    });
    const result = await runCatalogResearch(input, {
      client,
      ...dependencies(),
      readPage,
    });
    expect(result.researchStatus).toBe("failed");
    expect(result.outcome).toBe("failed");
    expect(result.errors).toContainEqual({
      code,
      message: `Source retrieval ${reasonCode}`,
      url,
      stage: "source",
    });
    expect(result.sourceSummaries).toEqual([]);
    expect(result.operations).toEqual([]);
    expect(readResearchCatalog(client)).toEqual([]);
  },
);
test.each(["provider", "budget"] as const)(
  "Research %s failure retains safe diagnostics and writes nothing",
  async (failure) => {
    const { client } = fixture();
    const result = await runCatalogResearch(input, {
      client,
      ...dependencies(),
      generateRoles: {
        research: async () => {
          throw failure === "budget"
            ? new ResearchLimitError("steps")
            : new Error("PRIVATE_PROVIDER_RESPONSE");
        },
      },
    });
    expect(result.researchStatus).toBe("failed");
    expect(result.operations).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: failure === "budget" ? "limit_reached" : "model_failed",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_RESPONSE");
  },
);

test.each([
  undefined,
  { status: "success", output: { checks: "invalid" } },
  {
    status: "not_run",
    modelResponse: null,
    errors: [],
    model: "fixture",
    promptVersion: "fixture",
    durationMs: 0,
  },
])(
  "rejects missing, invalid or skipped required specialist results without writes: %j",
  async (branch) => {
    const roles = await import("./roles/tickets/agent");
    vi.spyOn(roles, "runTickets").mockResolvedValue(branch as never);
    const { client } = testDatabase();
    const apply = vi.spyOn(applyModule, "applyCatalogItem");
    const result = await runCatalogResearch(
      {
        mode: "add",
        input: "Example Fest",
        actor: "catalog-research",
        dryRun: false,
      },
      { client, ...fixtureDependencies() },
    );
    expect(result.outcome).toBe("failed");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "workflow_failed" }),
    );
    expect(result.operations).toEqual([]);
    expect(apply).not.toHaveBeenCalled();
    expect(readResearchCatalog(client)).toEqual([]);
  },
);

test("retains other specialist diagnostics when Links fails", async () => {
  const roles = await import("./roles/links/agent");
  vi.spyOn(roles, "runLinks").mockResolvedValue({
    status: "failed",
    modelResponse: null,
    errors: [
      { code: "model_failed", stage: "research", message: "Links failed" },
    ],
    model: "fixture",
    promptVersion: "fixture",
    durationMs: 0,
  });
  const { client } = testDatabase();
  const result = await runCatalogResearch(
    { mode: "add", input: "Example Fest", actor: "test", dryRun: false },
    {
      client,
      ...fixtureDependencies(),
      generateLocation: async (raw) => {
        const plan = fixtureLocationPlan(JSON.parse(raw));
        if (plan.decision.status === "ready") {
          plan.decision.currentOrNextEdition!.unresolved.push({
            field: "coordinates",
            message: "Venue point remains unknown",
          });
        }
        return plan;
      },
    },
  );
  expect(result.outcome).toBe("failed");
  expect(result.locationStatus).toBe("success");
  expect(result.unresolved).toContainEqual(
    expect.objectContaining({
      field: "coordinates",
      message: "Venue point remains unknown",
    }),
  );
  expect(result.errors.some((error) => error.code === "model_failed")).toBe(
    true,
  );
  expect(result.errors.some((error) => error.code === "workflow_failed")).toBe(
    false,
  );
  expect(result.operations).toEqual([]);
  expect(readResearchCatalog(client)).toEqual([]);
});

test("add preserves a long note for collection, keeps it out of General, and uses source identity and dates", async () => {
  const { client } = fixture();
  const note = `  Maybe Another Festival in 2030.\nPin 38.7,-9.1\n${"Tentative clue. ".repeat(50)}\nhttps://organizer.test/last-line\n`;
  const deps = dependencies();
  const research = deps.generateRole!;
  const collected = vi.fn();
  const report = await runCatalogResearch(
    { ...input, input: note, dryRun: false },
    {
      ...deps,
      client,
      generateRoles: {
        research: async (role, prompt, context) => {
          const data = JSON.parse(prompt);
          expect(data.researchNote).toBe(note);
          expect(data.identityContext.requestedName).toBeUndefined();
          collected();
          return research(role, prompt, context);
        },
        general: async (role, prompt, context) => {
          expect(prompt).not.toContain("Maybe Another Festival");
          expect(prompt).not.toContain("organizer.test/last-line");
          return research(role, prompt, context);
        },
      },
    },
  );
  expect(collected).toHaveBeenCalledOnce();
  expect(report.outcome).not.toBe("failed");
  expect(
    client.prepare("SELECT canonical_name FROM events").pluck().get(),
  ).toBe("Example Fest");
  expect(client.prepare("SELECT starts_on FROM editions").pluck().get()).toBe(
    "2027-07-01",
  );
  expect(
    JSON.parse(
      client
        .prepare("SELECT input_json FROM ingestion_runs")
        .pluck()
        .get() as string,
    ).input,
  ).toBe(note);
});

test("a complete note that exceeds the collector context limit fails explicitly without catalog writes", async () => {
  const { client } = fixture();
  const note = "input ".repeat(70000) + "\nLAST_LINE";
  const research = vi.fn();
  const report = await runCatalogResearch(
    { ...input, input: note, dryRun: false },
    { ...dependencies(), client, generateRole: research },
  );
  expect(report.outcome).toBe("failed");
  expect(report.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "limit_reached" }),
    ]),
  );
  expect(research).not.toHaveBeenCalled();
  expect(client.prepare("SELECT count(*) FROM events").pluck().get()).toBe(0);
  expect(
    JSON.parse(
      client
        .prepare("SELECT input_json FROM ingestion_runs")
        .pluck()
        .get() as string,
    ).input,
  ).toBe(note);
});

test.each(["pin-only", "city", "city-no-point"] as const)(
  "add keeps map echoes as leads and resolves source city only (%s)",
  async (scenario) => {
    const { fixtureTool, fixtureLocationPlan } =
      await import("@/test/ingestion");
    const { client } = fixture();
    const pin = "https://maps.example.org/?q=38.123,-9.456";
    const official =
      scenario === "pin-only"
        ? "Example Fest 2027, July 1–3. Venue not announced."
        : "Example Fest 2027, July 1–3, Lisbon, Portugal. Venue not announced.";
    const deps = fixtureDependencies({
      research: async (
        _role: unknown,
        prompt: string,
        ctx: Parameters<import("./roles/invoke").GenerateRole>[2],
      ) => {
        expect(JSON.parse(prompt).researchNote).toContain(pin);
        await fixtureTool(ctx, "inspectPage", { url: pin });
        await fixtureTool(ctx, "inspectPage", { url });
        return {
          checks: JSON.parse(prompt).checks.map(({ key }: { key: string }) => ({
            check: key,
            sourceIds: ["s2"],
            blocker: null,
          })),
          unresolved: [],
        };
      },
      reader: async (_role: unknown, prompt: string) => {
        const data = JSON.parse(prompt);
        const echo = data.page.includes("Map pin");
        expect(JSON.stringify(data.assignment)).not.toContain(pin);
        return {
          overview: echo
            ? "Map pin echo, no festival relationship."
            : "Festival announcement.",
          coverage: { found: [], notPublished: [] },
          topics: ["identity", "dates", "location"],
          statedYears: [],
          limitations: [],
          evidence: [
            { quote: data.page, topics: ["identity", "dates", "location"] },
          ],
        };
      },
      general: async () =>
        JSON.parse(
          JSON.stringify(fixtureTargets()).replaceAll("s1-e1", "s2-e1"),
        ),
    });
    const report = await runCatalogResearch(
      { ...input, input: `Tentative pin ${pin}`, dryRun: false },
      {
        ...deps,
        client,
        readPage: async (pageUrl, { budget }) => {
          budget.consumePage();
          return {
            attemptedUrl: pageUrl,
            finalUrl: pageUrl,
            retrievedAt: "2026-11-01T00:00:00Z",
            method: "http",
            status: "ok",
            markdown:
              pageUrl === pin ? "Map pin 38.123,-9.456 near Lisbon." : official,
          };
        },
        generateLocation: async (prompt, ctx) => {
          const data = JSON.parse(prompt);
          expect(JSON.stringify(data.evidence)).toContain("Map pin 38.123");
          const plan = fixtureLocationPlan(data);
          if (plan.decision.status !== "ready") {
            throw new Error("Expected ready fixture");
          }
          const slot = plan.decision.currentOrNextEdition!;
          slot.evidenceIds = ["s2-e1"];
          if (scenario !== "pin-only") {
            slot.fields.locality = {
              action: "set",
              value: "Lisbon",
              reason: "Organizer confirms Lisbon.",
            };
            slot.fields.countryCode = {
              action: "set",
              value: "PT",
              reason: "Organizer confirms Portugal.",
            };
            const found = (await ctx.geocode({
              query: "Lisbon",
              countryCode: "PT",
            })) as { points: { id: string }[] };
            if (found.points[0]) {
              slot.coordinates = {
                action: "select",
                pointId: found.points[0].id,
                precision: "locality",
                reason: "Only the city is confirmed.",
              };
            }
          }
          return plan;
        },
        geocodingClient: async (request) =>
          request.direction === "forward" && scenario === "city"
            ? {
                status: "success",
                direction: "forward",
                candidates: [
                  {
                    latitude: 38.72,
                    longitude: -9.14,
                    placeId: null,
                    label: "Lisbon",
                    name: null,
                    countryCode: "PT",
                    locality: "Lisbon",
                    address: null,
                    objectType: "locality",
                    originalType: "city",
                    category: null,
                    confidence: null,
                  },
                ],
              }
            : { status: "error", code: "unavailable" },
      },
    );
    expect(
      report.outcome,
      JSON.stringify({
        errors: report.errors,
        unresolved: report.unresolved,
        location: report.locationResponse,
        general: report.modelResponse,
      }),
    ).not.toBe("failed");
    const place = client
      .prepare(
        "SELECT latitude,longitude,coordinate_precision,venue_name FROM editions",
      )
      .get();
    expect(place).toEqual(
      scenario === "city"
        ? {
            latitude: 38.72,
            longitude: -9.14,
            coordinate_precision: "locality",
            venue_name: null,
          }
        : {
            latitude: null,
            longitude: null,
            coordinate_precision: "unknown",
            venue_name: null,
          },
    );
  },
);

test("Studio validates each mode and its input", () => {
  for (const input of [
    "Festival name",
    "https://organizer.test/",
    "  clue\nlast line  ",
  ]) {
    expect(
      studioIngestionInputSchema.parse({ mode: "add", input }),
    ).toMatchObject({ input, dryRun: true });
  }
  expect(
    studioIngestionInputSchema.parse({
      mode: "refresh",
      input: { eventId: "id" },
    }),
  ).toMatchObject({ input: { eventId: "id", scope: "full" }, dryRun: true });
  for (const value of [
    { mode: "add" },
    { mode: "add", input: " \n" },
    { mode: "add", name: "Old field" },
    { mode: "refresh", input: "clue" },
    { mode: "refresh", eventId: "id" },
    { mode: "add", input: { eventId: "id" } },
    { mode: "refresh", input: { eventId: "id", scope: "next" } },
  ]) {
    expect(studioIngestionInputSchema.safeParse(value).success).toBe(false);
  }
});
