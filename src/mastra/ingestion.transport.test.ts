import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { runCatalogResearch } from "../ingestion/workflow";
import { testDatabase } from "../test/database";
import { testFixtures } from "../test/fixtures";
import {
  startStudioFixture,
  STUDIO_FIXTURE_EVENT_ID,
  type StudioScenario,
} from "../test/studio-fixture";

type Fixture = Awaited<ReturnType<typeof startStudioFixture>>;
let fixture: Fixture;

async function request(
  server: Fixture,
  path: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(
    `${server.baseUrl}/api/workflows/catalog-ingestion/${path}`,
    {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  return { response, text: await response.text() };
}

async function createRun(server: Fixture) {
  const created = await request(server, "create-run", {});
  expect(created.response.status, created.text).toBe(200);
  const runId = (JSON.parse(created.text) as { runId: string }).runId;
  expect(runId).toBeTruthy();
  return runId;
}

function rows(server: Fixture) {
  const client = new Database(server.catalogPath, { readonly: true });
  try {
    return client
      .prepare("SELECT * FROM ingestion_runs ORDER BY started_at")
      .all() as Record<string, unknown>[];
  } finally {
    client.close();
  }
}

async function run(
  server: Fixture,
  inputData: Record<string, unknown>,
  route: "start" | "start-async" | "stream" = "stream",
) {
  const runId = await createRun(server);
  const started = await request(server, `${route}?runId=${runId}`, {
    inputData,
  });
  return { runId, ...started };
}

function streamResult(text: string): Record<string, unknown> {
  const chunks = text
    .split("\u001e")
    .filter(Boolean)
    .map(
      (chunk) =>
        JSON.parse(chunk) as {
          type: string;
          payload?: { id?: string; output?: Record<string, unknown> };
        },
    );
  const final = chunks.find(
    (chunk) =>
      chunk.type === "workflow-step-result" &&
      chunk.payload?.id === "finalize-run",
  );
  if (!final?.payload?.output) {
    throw new Error(`No final projection in stream: ${text}`);
  }
  return final.payload.output;
}

beforeAll(async () => {
  fixture = await startStudioFixture("success");
}, 60_000);
afterAll(async () => {
  await fixture?.stop();
}, 10_000);

test("native create and start expose a bounded preview, then apply under a fresh ingestion ID", async () => {
  const inputData = { mode: "refresh", eventId: STUDIO_FIXTURE_EVENT_ID };
  const preview = await run(fixture, inputData);
  expect(
    preview.response.status,
    `${preview.text}\n${JSON.stringify(rows(fixture))}\n${fixture.output()}`,
  ).toBe(200);
  const previewResult = streamResult(preview.text);
  expect(previewResult).toMatchObject({
    engineRunId: preview.runId,
    mode: "refresh",
    dryRun: true,
    persistenceStatus: "completed",
  });
  expect(preview.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
  const afterPreview = rows(fixture);
  expect(afterPreview).toHaveLength(1);
  expect(afterPreview[0].status).toBe("completed");
  expect(JSON.parse(afterPreview[0].report_json as string).schemaVersion).toBe(
    2,
  );
  const catalog = new Database(fixture.catalogPath, { readonly: true });
  try {
    expect(
      catalog
        .prepare("SELECT COUNT(*) count FROM occurrences WHERE event_id=?")
        .get(STUDIO_FIXTURE_EVENT_ID),
    ).toEqual({ count: 0 });
  } finally {
    catalog.close();
  }

  const applied = await run(fixture, { ...inputData, dryRun: false });
  expect(applied.response.status, applied.text).toBe(200);
  const appliedResult = streamResult(applied.text);
  expect(appliedResult).toMatchObject({
    engineRunId: applied.runId,
    mode: "refresh",
    dryRun: false,
    persistenceStatus: "completed",
  });
  const durable = rows(fixture);
  expect(durable).toHaveLength(2);
  expect(durable[0].id).not.toBe(durable[1].id);
  const studioReport = JSON.parse(durable[1].report_json as string) as {
    outcome: string;
    researchStatus: string;
    operations: { kind: string }[];
    changes: { field: string }[];
  };
  const cliClient = testDatabase().client;
  const cliFixtures = testFixtures(cliClient);
  const cliEvent = cliFixtures.event({
    id: STUDIO_FIXTURE_EVENT_ID,
    canonicalName: "Studio Fixture Festival",
  });
  cliFixtures.eventLink(cliEvent, {
    url: "https://example.org/studio-fixture",
  });
  const cliResult = await runCatalogResearch(
    {
      mode: "refresh",
      eventId: STUDIO_FIXTURE_EVENT_ID,
      actor: "catalog-research",
      dryRun: false,
    },
    {
      client: cliClient,
      todayUtc: "2026-10-10",
      readSource: async (url, { budget }) => {
        budget.consumePage();
        return {
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: "2026-10-10T12:00:00Z",
          method: "http" as const,
          outcome: "ok" as const,
          completeness: "full" as const,
          markdown:
            "PRIVATE_STUDIO_FIXTURE_SENTINEL Fixture festival starts July 1, 2027.",
          links: [],
        };
      },
      generateCandidate: async () => ({
        status: "success",
        data: {
          eventId: STUDIO_FIXTURE_EVENT_ID,
          eventName: "Studio Fixture Festival",
          sources: [
            {
              url: "https://example.org/studio-fixture",
              information: "PRIVATE_STUDIO_FIXTURE_SENTINEL",
            },
          ],
          links: { socials: {} },
          editions: [
            {
              key: "2027",
              year: { value: 2027, reason: "PRIVATE_STUDIO_FIXTURE_SENTINEL" },
              dates: {
                value: {
                  startsOn: "2027-07-01",
                  endsOn: "2027-07-03",
                  state: "confirmed",
                },
                reason: "PRIVATE_STUDIO_FIXTURE_SENTINEL",
              },
              countryCode: {
                value: "PT",
                reason: "PRIVATE_STUDIO_FIXTURE_SENTINEL",
              },
              locality: {
                value: "Lisbon",
                reason: "PRIVATE_STUDIO_FIXTURE_SENTINEL",
              },
              links: {},
            },
          ],
        },
        errors: [],
        unresolved: [],
      }),
    },
  );
  expect(studioReport.outcome).toBe(cliResult.outcome);
  expect(studioReport.researchStatus).toBe(cliResult.researchStatus);
  expect(studioReport.operations.map((operation) => operation.kind)).toEqual(
    cliResult.operations.map((operation) => operation.kind),
  );
  expect(studioReport.changes.map((change) => change.field)).toEqual(
    cliResult.changes.map((change) => change.field),
  );
  const afterApply = new Database(fixture.catalogPath, { readonly: true });
  try {
    expect(
      afterApply
        .prepare("SELECT COUNT(*) count FROM occurrences WHERE event_id=?")
        .get(STUDIO_FIXTURE_EVENT_ID),
    ).toEqual({ count: 1 });
  } finally {
    afterApply.close();
  }
  const fetched = await fetch(
    `${fixture.baseUrl}/api/workflows/catalog-ingestion/runs/${applied.runId}`,
  );
  expect(fetched.status).toBe(404);
  expect(await fetched.text()).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
  const inspection = await fetch(`${fixture.baseUrl}/api/observability/logs`);
  expect(inspection.status).toBe(200);
  expect(await inspection.text()).not.toContain(
    "PRIVATE_STUDIO_FIXTURE_SENTINEL",
  );
}, 60_000);

test("graph inspection needs no catalog and execution does not create one", async () => {
  const server = await startStudioFixture("success", { catalog: false });
  try {
    const graph = await fetch(
      `${server.baseUrl}/api/workflows/catalog-ingestion`,
    );
    expect(graph.status).toBe(200);
    const description = await graph.text();
    for (const step of [
      "initialize-run",
      "research-festival",
      "apply-catalog-item",
      "finalize-run",
    ]) {
      expect(description).toContain(step);
    }
    expect(existsSync(server.catalogPath)).toBe(false);
    const started = await run(server, {
      mode: "check",
      eventId: STUDIO_FIXTURE_EVENT_ID,
    });
    expect(started.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
    expect(existsSync(server.catalogPath)).toBe(false);
  } finally {
    await server.stop();
  }
}, 60_000);

test("per-step starts and replay routes are rejected before durable allocation", async () => {
  const baseline = rows(fixture).length;
  const runId = await createRun(fixture);
  for (const route of [
    "start",
    "start-async",
    "stream",
    "stream-legacy",
    "streamVNext",
  ]) {
    const rejected = await request(fixture, `${route}?runId=${runId}`, {
      inputData: { mode: "check", eventId: STUDIO_FIXTURE_EVENT_ID },
      perStep: true,
    });
    expect(rejected.response.status, `${route}: ${rejected.text}`).toBe(400);
    expect(rejected.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
  }
  for (const route of [
    "resume",
    "resume-async",
    "resume-stream",
    "restart",
    "restart-async",
    "time-travel",
    "time-travel-async",
    "time-travel-stream",
  ]) {
    const rejected = await request(fixture, `${route}?runId=${runId}`, {});
    expect(rejected.response.status, `${route}: ${rejected.text}`).toBe(400);
  }
  expect(rows(fixture)).toHaveLength(baseline);
}, 30_000);

test.each(["partial", "failure"] satisfies StudioScenario[])(
  "native server projects %s research with a durable report and no private transport data",
  async (scenario) => {
    const server = await startStudioFixture(scenario);
    try {
      const started = await run(server, {
        mode: "check",
        eventId: STUDIO_FIXTURE_EVENT_ID,
      });
      expect(
        started.response.status,
        `${started.text}\n${server.output()}`,
      ).toBe(200);
      expect(started.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
      const result = streamResult(started.text);
      expect(result, started.text).toMatchObject({
        engineRunId: started.runId,
        researchStatus: scenario === "partial" ? "partial" : "failed",
        persistenceStatus: "completed",
      });
      const durable = rows(server);
      expect(durable).toHaveLength(1);
      expect(JSON.parse(durable[0].report_json as string)).toMatchObject({
        schemaVersion: 2,
        researchStatus: scenario === "partial" ? "partial" : "failed",
      });
    } finally {
      await server.stop();
    }
  },
  60_000,
);

test("native cancel route closes an in-flight run without later catalog writes", async () => {
  const server = await startStudioFixture("agent-cancel");
  try {
    const runId = await createRun(server);
    const pending = request(server, `start-async?runId=${runId}`, {
      inputData: {
        mode: "refresh",
        eventId: STUDIO_FIXTURE_EVENT_ID,
        dryRun: false,
      },
    });
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    const cancelled = await request(server, `runs/${runId}/cancel`, {});
    expect(cancelled.response.ok, cancelled.text).toBe(true);
    await pending;
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
    const durable = rows(server);
    expect(durable).toHaveLength(1);
    expect(durable[0].status).toBe("failed");
    expect(durable[0].report_json).toContain("cancelled");
    const client = new Database(server.catalogPath, { readonly: true });
    try {
      expect(
        client
          .prepare("SELECT COUNT(*) count FROM occurrences WHERE event_id=?")
          .get(STUDIO_FIXTURE_EVENT_ID),
      ).toEqual({ count: 0 });
    } finally {
      client.close();
    }
  } finally {
    await server.stop();
  }
}, 70_000);

test("final persistence failure keeps the committed catalog change and hides the database error", async () => {
  const server = await startStudioFixture("agent-persistence");
  try {
    const started = await run(server, {
      mode: "refresh",
      eventId: STUDIO_FIXTURE_EVENT_ID,
      dryRun: false,
    });
    expect(started.response.status, started.text).toBe(200);
    expect(started.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
    expect(started.text).toContain("run_persistence_failed");
    const finalPacket = started.text
      .split("\u001e")
      .filter(Boolean)
      .map(
        (chunk) =>
          JSON.parse(chunk) as {
            type: string;
            payload?: { id?: string; error?: { message?: string } };
          },
      )
      .find(
        (chunk) =>
          chunk.type === "workflow-step-result" &&
          chunk.payload?.id === "finalize-run",
      );
    const safeError = JSON.parse(
      finalPacket?.payload?.error?.message ?? "null",
    ) as Record<string, unknown>;
    expect(safeError).toMatchObject({
      code: "run_persistence_failed",
      summary: {
        engineRunId: started.runId,
        mode: "refresh",
        dryRun: false,
        persistenceStatus: "failed",
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    });
    const durable = rows(server);
    expect(durable).toHaveLength(1);
    expect(durable[0].status).toBe("running");
    const client = new Database(server.catalogPath, { readonly: true });
    try {
      expect(
        client
          .prepare("SELECT COUNT(*) count FROM occurrences WHERE event_id=?")
          .get(STUDIO_FIXTURE_EVENT_ID),
      ).toEqual({ count: 1 });
    } finally {
      client.close();
    }
  } finally {
    await server.stop();
  }
}, 60_000);

test("offline model exercises the real agent path without exposing provider or page content", async () => {
  const server = await startStudioFixture("agent");
  try {
    const started = await run(server, {
      mode: "check",
      eventId: STUDIO_FIXTURE_EVENT_ID,
    });
    expect(started.response.status, `${started.text}\n${server.output()}`).toBe(
      200,
    );
    expect(started.text).not.toContain("PRIVATE_STUDIO_FIXTURE_SENTINEL");
    const result = streamResult(started.text);
    expect(result).toMatchObject({
      researchStatus: "success",
      persistenceStatus: "completed",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    expect(rows(server)).toHaveLength(1);
  } finally {
    await server.stop();
  }
}, 60_000);

test("recorded apply traces and logs stay private while the shared store serves later runs", async () => {
  const server = await startStudioFixture("agent-recording");
  let stopped = false;
  try {
    const applied = await run(server, {
      mode: "refresh",
      eventId: STUDIO_FIXTURE_EVENT_ID,
      dryRun: false,
    });
    expect(applied.response.status, applied.text).toBe(200);
    const appliedSummary = streamResult(applied.text);
    expect(appliedSummary).toMatchObject({
      engineRunId: applied.runId,
      persistenceStatus: "completed",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const preview = await run(server, {
      mode: "check",
      eventId: STUDIO_FIXTURE_EVENT_ID,
    });
    expect(preview.response.status, preview.text).toBe(200);
    expect(streamResult(preview.text)).toMatchObject({
      dryRun: true,
      persistenceStatus: "completed",
    });
    const inspection = await fetch(`${server.baseUrl}/api/observability/logs`);
    expect(inspection.status).toBe(200);
    expect(await inspection.text()).not.toContain(
      "PRIVATE_STUDIO_FIXTURE_SENTINEL",
    );
    await server.stop(true);
    stopped = true;
    const saved = JSON.parse(
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/tsx/dist/cli.mjs"),
          resolve("src/test/read-observability.ts"),
          server.tracePath,
        ],
        { encoding: "utf8" },
      ),
    ) as {
      mastra_ai_spans: Record<string, unknown>[];
      mastra_logs: Record<string, unknown>[];
    };
    expect(saved.mastra_ai_spans.length).toBeGreaterThan(0);
    expect(saved.mastra_logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(saved)).not.toContain(
      "PRIVATE_STUDIO_FIXTURE_SENTINEL",
    );
    const spans = JSON.stringify(saved.mastra_ai_spans);
    expect(spans).toContain(applied.runId);
    expect(spans).toContain(String(appliedSummary.ingestionRunId));
    expect(spans).not.toContain(preview.runId);
  } finally {
    if (!stopped) {
      await server.stop();
    } else {
      rmSync(server.directory, { recursive: true, force: true });
    }
  }
}, 70_000);
