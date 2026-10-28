import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Mastra } from "@mastra/core/mastra";
import { SpanType } from "@mastra/core/observability";
import { DuckDBStore } from "@mastra/duckdb";
import {
  DefaultObservabilityInstance,
  Observability,
} from "@mastra/observability";
import {
  createResearchObservability,
  createRunObservability,
  finishResearchObservability,
  finishRunObservability,
} from "./runtime";
import { createObservabilityStore, observabilityDatabasePath } from "./storage";
import { readTraceRows } from "@/test/tracing-fixture";

const directories: string[] = [];
function directory() {
  const path = mkdtempSync(join(tmpdir(), "catalog-tracing-"));
  directories.push(path);
  return path;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const path of directories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

test.each(["test", "development"])(
  "tracing defaults off in %s and never opens storage",
  async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    vi.stubEnv("CATALOG_LOGGING", "false");
    const path = join(directory(), "off.duckdb");
    vi.stubEnv("CATALOG_TRACING", "false");
    vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", path);
    expect(
      await createResearchObservability(
        { mode: "add", name: "Fixture", actor: "test", initiatedBy: "test" },
        "fixture/model",
      ),
    ).toBeUndefined();
    expect(existsSync(path)).toBe(false);
  },
);

test("website analytics does not enable ingestion tracing", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-project");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://example.org");
  vi.stubEnv("CATALOG_TRACING", "false");
  vi.stubEnv("CATALOG_LOGGING", "false");
  const path = join(directory(), "off.duckdb");
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", path);
  expect(
    await createResearchObservability(
      { mode: "add", name: "Fixture", actor: "test", initiatedBy: "test" },
      "fixture/model",
    ),
  ).toBeUndefined();
  expect(existsSync(path)).toBe(false);
});

test("a registered run leaves its caller-owned observability store open", async () => {
  vi.stubEnv("CATALOG_LOGGING", "true");
  vi.stubEnv("CATALOG_TRACING", "false");
  vi.stubEnv(
    "CATALOG_OBSERVABILITY_DATABASE_PATH",
    join(directory(), "shared.duckdb"),
  );
  const store = await createObservabilityStore();
  await store.init();
  const close = vi.spyOn(store, "close");
  try {
    const run = await createRunObservability(
      { mode: "add", name: "Fixture", actor: "catalog-research", dryRun: true },
      "fixture/model",
      "shared-run",
      [],
      store,
    );
    expect(run).toBeDefined();
    await finishRunObservability(run);
    expect(close).not.toHaveBeenCalled();
    expect(await store.getStore("observability")).toBeTruthy();
  } finally {
    await store.close();
  }
});

test("concurrent runs retain both traces after their shared store closes", async () => {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_LOGGING", "false");
  const path = join(directory(), "concurrent.duckdb");
  vi.stubEnv("CATALOG_OBSERVABILITY_DATABASE_PATH", path);
  const store = await createObservabilityStore();
  await store.init();
  const runs = await Promise.all(
    ["first", "second"].map((runId) =>
      createRunObservability(
        { mode: "add", name: "Fixture", actor: "test" },
        "fixture/model",
        runId,
        [],
        store,
        "concurrent-experiment",
      ),
    ),
  );
  try {
    expect(runs.every((run) => !!run?.root)).toBe(true);
    await Promise.all(runs.map((run) => finishRunObservability(run)));
  } finally {
    await store.close();
  }
  const rows = await readTraceRows(path);
  expect(new Set(rows.mastra_ai_spans.map((span) => span.traceId))).toEqual(
    new Set(runs.map((run) => run!.root!.traceId)),
  );
  expect(rows.mastra_ai_spans).toHaveLength(2);
  expect(rows.mastra_ai_spans.every((span) => !!span.endedAt)).toBe(true);
  expect(
    rows.mastra_ai_spans.every(
      (span) => span.experimentId === "concurrent-experiment",
    ),
  ).toBe(true);
});

test.each(["rejection", "timeout"] as const)(
  "shared-store initialization failure survives cleanup %s",
  async (failure) => {
    vi.stubEnv("CATALOG_LOGGING", "false");
    vi.stubEnv("CATALOG_TRACING", "true");
    vi.stubEnv(
      "CATALOG_OBSERVABILITY_DATABASE_PATH",
      join(directory(), "failed-shared.duckdb"),
    );
    const store = await createObservabilityStore();
    await store.init();
    const close = vi.spyOn(store, "close");
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    // Root creation happens after Mastra takes the shared store. A failure here
    // must disable optional observations without failing the ingestion attempt.
    vi.spyOn(
      DefaultObservabilityInstance.prototype,
      "startSpan",
    ).mockImplementation(() => {
      throw new Error("PRIVATE_INITIALIZATION_ERROR");
    });
    const originalShutdown = Observability.prototype.shutdown;
    const shutdown = vi
      .spyOn(Observability.prototype, "shutdown")
      .mockImplementation(() =>
        failure === "rejection"
          ? Promise.reject(new Error("PRIVATE_SHUTDOWN_ERROR"))
          : new Promise<void>(() => {}),
      );
    try {
      await expect(
        createRunObservability(
          {
            mode: "add",
            name: "Fixture",
            actor: "catalog-research",
            dryRun: false,
          },
          "fixture/model",
          "failed-shared-run",
          [],
          store,
        ),
      ).resolves.toBeUndefined();
      expect(shutdown).toHaveBeenCalledOnce();
      expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
        "trace_initialization_failed\ntrace_shutdown_failed\n",
      );
      expect(close).not.toHaveBeenCalled();
      expect(await store.getStore("observability")).toBeTruthy();
    } finally {
      if (shutdown.mock.instances[0]) {
        await originalShutdown.call(shutdown.mock.instances[0]);
      }
      await store.close();
    }
  },
);

test("the shared local path is absolute and cannot select the catalog", () => {
  const cwd = directory();
  expect(observabilityDatabasePath({ NODE_ENV: "test" }, cwd)).toBe(
    resolve(cwd, "data/mastra-observability.duckdb"),
  );
  expect(
    observabilityDatabasePath(
      {
        NODE_ENV: "test",
        CATALOG_OBSERVABILITY_DATABASE_PATH: "custom/observability.duckdb",
      },
      cwd,
    ),
  ).toBe(resolve(cwd, "custom/observability.duckdb"));
  const catalog = join(cwd, "catalog.sqlite");
  writeFileSync(catalog, "catalog sentinel");
  const alias = join(cwd, "alias.sqlite");
  symlinkSync(catalog, alias);
  for (const path of [catalog, alias]) {
    expect(() =>
      observabilityDatabasePath(
        {
          NODE_ENV: "test",
          CATALOG_OBSERVABILITY_DATABASE_PATH: path,
          DATABASE_PATH: catalog,
        },
        cwd,
      ),
    ).toThrow("separate");
  }
});

test("asynchronous initialization failure emits a safe diagnostic and falls back", async () => {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv(
    "CATALOG_OBSERVABILITY_DATABASE_PATH",
    join(directory(), "failed.duckdb"),
  );
  vi.spyOn(DuckDBStore.prototype, "init").mockRejectedValue(
    new Error("PRIVATE_DATABASE_ERROR"),
  );
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(
    await createResearchObservability(
      { mode: "add", name: "Fixture", actor: "test", initiatedBy: "test" },
      "fixture/model",
    ),
  ).toBeUndefined();
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
    "trace_initialization_failed\n",
  );
});

test.each([false, true])(
  "cleanup always flushes before shutdown and survives flush failure %s",
  async (failFlush) => {
    const order: string[] = [];
    const diagnose = vi.fn();
    const mastra = {
      observability: {
        flush: async () => {
          order.push("flush");
          if (failFlush) {
            throw new Error("private flush");
          }
        },
      },
      shutdown: async () => {
        order.push("shutdown");
        throw new Error("private shutdown");
      },
    } as unknown as Pick<Mastra, "observability" | "shutdown">;
    await expect(
      finishResearchObservability(mastra, diagnose),
    ).resolves.toBeUndefined();
    expect(order).toEqual(["flush", "shutdown"]);
    expect(diagnose.mock.calls).toEqual(
      failFlush
        ? [["trace_flush_failed"], ["trace_shutdown_failed"]]
        : [["trace_shutdown_failed"]],
    );
  },
);

test("native sensitive data filtering preserves content and redacts secret fields", async () => {
  const tracing = await enabledTracing();
  const mastra = new Mastra({
    logger: false,
    storage: tracing.storage,
    observability: tracing.observability,
  });
  const span = tracing.observability.getDefaultInstance()!.startSpan({
    type: SpanType.GENERIC,
    name: "native-filter",
    input: { prompt: "Inspect this public page", password: "PRIVATE_PASSWORD" },
  });
  span.end({ output: { text: "Public result", apiKey: "PRIVATE_API_KEY" } });
  await finishResearchObservability(mastra, tracing.diagnose);
  const rows = await readTraceRows(
    process.env.CATALOG_OBSERVABILITY_DATABASE_PATH!,
  );
  const saved = JSON.stringify(rows);
  expect(saved).toContain("Inspect this public page");
  expect(saved).toContain("Public result");
  expect(saved).not.toContain("PRIVATE_PASSWORD");
  expect(saved).not.toContain("PRIVATE_API_KEY");
});

async function enabledTracing() {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv(
    "CATALOG_OBSERVABILITY_DATABASE_PATH",
    join(directory(), "traces.duckdb"),
  );
  const tracing = await createResearchObservability(
    {
      mode: "refresh",
      eventId: "fixture-event",
      actor: "test",
      initiatedBy: "test",
    },
    "fixture/model",
  );
  if (!tracing) {
    throw new Error("Tracing did not initialize");
  }
  return tracing;
}

test("exporter write failures use native SDK diagnostics", async () => {
  const tracing = await enabledTracing();
  const store = (await tracing.storage.getStore("observability"))!;
  vi.spyOn(store, "batchCreateSpans").mockRejectedValue(
    new Error("PRIVATE_WRITE_FAILURE"),
  );
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const mastra = new Mastra({
    logger: false,
    storage: tracing.storage,
    observability: tracing.observability,
  });
  tracing.observability.setLogger({ logger: tracing.logger });
  const span = tracing.observability
    .getDefaultInstance()!
    .startSpan({ type: SpanType.AGENT_RUN, name: "test" });
  span.end();
  await finishResearchObservability(mastra, tracing.diagnose);
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toContain(
    "PRIVATE_WRITE_FAILURE",
  );
});

test("tracing ignores logging level when application logging is disabled", async () => {
  vi.stubEnv("CATALOG_LOGGING", "false");
  vi.stubEnv("CATALOG_LOG_LEVEL", "invalid-unused-level");
  const tracing = await enabledTracing();
  expect(tracing.traceEnabled).toBe(true);
  expect(tracing.loggingEnabled).toBe(false);
  const mastra = new Mastra({
    logger: false,
    loggerOptions: { export: false },
    storage: tracing.storage,
    observability: tracing.observability,
  });
  await finishResearchObservability(mastra, tracing.diagnose);
});
