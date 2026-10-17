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
  ResearchObservabilityExporter,
} from "./runtime";
import { researchSpanProcessor } from "../tracing/processor";
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

test("tracing defaults off and never opens storage", async () => {
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
      true,
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
          false,
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

test("sanitization mutates a live span, excludes residual contents and drops on failure", async () => {
  const tracing = await enabledTracing();
  const mastra = new Mastra({
    logger: false,
    storage: tracing.storage,
    observability: tracing.observability,
  });
  tracing.observability.setLogger({ logger: tracing.logger });
  const instance = tracing.observability.getDefaultInstance()!;
  const forwardedLogs = vi.spyOn(
    ResearchObservabilityExporter.prototype,
    "onLogEvent",
  );
  const span = instance.startSpan({
    type: SpanType.AGENT_RUN,
    name: "unsafe root",
    input: "PRIVATE_PROMPT",
  });
  instance
    .getLoggerContext?.(span)
    .error("PRIVATE_SDK_LOG", { secret: "PRIVATE_LOG_METADATA" });
  expect(forwardedLogs).not.toHaveBeenCalled();
  const diagnose = vi.fn();
  const processor = researchSpanProcessor(
    { mode: "refresh", model: "fixture/model", promptVersion: "v1" },
    diagnose,
  );
  span.attributes = {
    instructions: "PRIVATE_INSTRUCTIONS",
    prompt: "PRIVATE_PROMPT",
  };
  span.metadata = { providerMetadata: "PRIVATE_METADATA" };
  span.requestContext = { authorization: "PRIVATE_KEY" };
  span.errorInfo = {
    message: "PRIVATE_ERROR",
    details: { responseBody: "PRIVATE_BODY" },
  };
  expect(processor.process(span)).toBe(span);
  expect(JSON.stringify(span.exportSpan())).not.toContain("PRIVATE_");
  expect(span.errorInfo).toEqual({ message: "operation_failed" });
  // A getter failure exercises the fail-closed path, rather than an SDK catch.
  Object.defineProperty(span, "attributes", {
    get: () => {
      throw new Error("PRIVATE_PROCESSOR_ERROR");
    },
    configurable: true,
  });
  expect(processor.process(span)).toBeUndefined();
  expect(diagnose).toHaveBeenCalledWith("trace_sanitization_failed");
  Object.defineProperty(span, "attributes", { value: {}, writable: true });
  span.end();
  await finishResearchObservability(mastra, tracing.diagnose);
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

test("internally handled exporter write failures and drops emit only fixed codes", async () => {
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
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
    "trace_export_failed\n",
  );
});

test("missing mandatory processor disables tracing before creating a run", async () => {
  const { Observability } = await import("@mastra/observability");
  vi.spyOn(Observability.prototype, "getDefaultInstance").mockReturnValue(
    undefined,
  );
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv(
    "CATALOG_OBSERVABILITY_DATABASE_PATH",
    join(directory(), "unavailable.duckdb"),
  );
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(
    await createResearchObservability(
      { mode: "add", name: "Fixture", actor: "test" },
      "fixture/model",
    ),
  ).toBeUndefined();
  expect(stderr.mock.calls.map((call) => call[0]).join("")).toBe(
    "trace_initialization_failed\n",
  );
});

test("generic spans retain native entity context and exclude raw content across start/update/end", async () => {
  const tracing = await enabledTracing();
  expect(tracing.options).toMatchObject({
    hideInput: false,
    hideOutput: false,
  });
  const mastra = new Mastra({
    logger: false,
    storage: tracing.storage,
    observability: tracing.observability,
  });
  tracing.observability.setLogger({ logger: tracing.logger });
  const exported: string[] = [];
  const original = ResearchObservabilityExporter.prototype._exportTracingEvent;
  vi.spyOn(
    ResearchObservabilityExporter.prototype,
    "_exportTracingEvent",
  ).mockImplementation(async function (
    this: ResearchObservabilityExporter,
    event,
  ) {
    exported.push(JSON.stringify(event.exportedSpan));
    await original.call(this, event);
  });
  const span = tracing.observability.getDefaultInstance()!.startSpan({
    type: SpanType.GENERIC,
    name: "PRIVATE_NAME",
    input: "PRIVATE_INPUT",
    metadata: { secret: "PRIVATE_KEY" },
    entityName: "Fixture entity",
  });
  span.update({
    input: "PRIVATE_UPDATE",
    output: "PRIVATE_OUTPUT",
    attributes: { inputTokens: 12, secret: "PRIVATE_ATTRIBUTES" } as never,
  });
  span.end({ output: "PRIVATE_FINAL" });
  await finishResearchObservability(mastra, tracing.diagnose);
  expect(exported).toHaveLength(3);
  for (const event of exported) {
    expect(JSON.parse(event).entityName).toBe("Fixture entity");
  }
  expect(exported.join("")).not.toContain("PRIVATE_");
  const rows = await readTraceRows(
    process.env.CATALOG_OBSERVABILITY_DATABASE_PATH!,
  );
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_");
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
