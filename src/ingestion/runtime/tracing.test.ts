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
import { LibSQLStore } from "@mastra/libsql";
import {
  createResearchTracing,
  finishResearchTracing,
  researchSpanProcessor,
  traceDatabasePath,
} from "./tracing";
import { ResearchTraceExporter } from "./tracing";
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
  const path = join(directory(), "off.sqlite");
  vi.stubEnv("CATALOG_TRACING", "false");
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", path);
  expect(
    await createResearchTracing(
      { mode: "add", name: "Fixture", actor: "test", initiatedBy: "test" },
      "fixture/model",
    ),
  ).toBeUndefined();
  expect(existsSync(path)).toBe(false);
});

test("the shared local path is absolute and cannot select the catalog", () => {
  const cwd = directory();
  expect(traceDatabasePath({ NODE_ENV: "test" }, cwd)).toBe(
    resolve(cwd, "data/mastra-traces.sqlite"),
  );
  expect(
    traceDatabasePath(
      { NODE_ENV: "test", CATALOG_TRACE_DATABASE_PATH: "custom/traces.sqlite" },
      cwd,
    ),
  ).toBe(resolve(cwd, "custom/traces.sqlite"));
  const catalog = join(cwd, "catalog.sqlite");
  writeFileSync(catalog, "catalog sentinel");
  const alias = join(cwd, "alias.sqlite");
  symlinkSync(catalog, alias);
  for (const path of [catalog, alias]) {
    expect(() =>
      traceDatabasePath(
        {
          NODE_ENV: "test",
          CATALOG_TRACE_DATABASE_PATH: path,
          DATABASE_PATH: catalog,
        },
        cwd,
      ),
    ).toThrow("separate");
  }
});

test("asynchronous initialization failure emits a safe diagnostic and falls back", async () => {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", join(directory(), "failed.sqlite"));
  vi.spyOn(LibSQLStore.prototype, "init").mockRejectedValue(
    new Error("PRIVATE_DATABASE_ERROR"),
  );
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(
    await createResearchTracing(
      { mode: "add", name: "Fixture", actor: "test", initiatedBy: "test" },
      "fixture/model",
    ),
  ).toBeUndefined();
  expect(stderr.mock.calls.flat().join("")).toBe(
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
      finishResearchTracing(mastra, diagnose),
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
  const forwardedLogs = vi.spyOn(ResearchTraceExporter.prototype, "onLogEvent");
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
  await finishResearchTracing(mastra, tracing.diagnose);
});

async function enabledTracing() {
  vi.stubEnv("CATALOG_TRACING", "true");
  vi.stubEnv("CATALOG_TRACE_DATABASE_PATH", join(directory(), "traces.sqlite"));
  const tracing = await createResearchTracing(
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

test("a sanitizer failure in the exporter pipeline persists no unsafe span", async () => {
  const tracing = await enabledTracing();
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const mastra = new Mastra({
    logger: false,
    storage: tracing.storage,
    observability: tracing.observability,
  });
  tracing.observability.setLogger({ logger: tracing.logger });
  // Simulate an unexpected SDK value at the actual start/end export boundary.
  const span = tracing.observability.getDefaultInstance()!.startSpan({
    type: SpanType.AGENT_RUN,
    name: null as unknown as string,
    input: "PRIVATE_UNSANITIZED_PROMPT",
    metadata: { secret: "PRIVATE_UNSANITIZED_METADATA" },
  });
  span.end({ output: { text: "PRIVATE_UNSANITIZED_RESPONSE" } });
  await finishResearchTracing(mastra, tracing.diagnose);
  const rows = readTraceRows(process.env.CATALOG_TRACE_DATABASE_PATH!);
  expect(rows.mastra_ai_spans).toEqual([]);
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_");
  expect(stderr.mock.calls.flat().join("")).toBe("trace_sanitization_failed\n");
});

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
  await finishResearchTracing(mastra, tracing.diagnose);
  expect(stderr.mock.calls.flat().join("")).toBe("trace_export_failed\n");
});
