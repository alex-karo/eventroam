import { existsSync, realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MastraLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import {
  SpanType,
  type AnySpan,
  type SpanOutputProcessor,
} from "@mastra/core/observability";
import { traceText, boundTraceProjection } from "./trace-projections";
import { LibSQLStore } from "@mastra/libsql";
import {
  MastraStorageExporter,
  Observability,
  SamplingStrategyType,
} from "@mastra/observability";
import type { CatalogResearchInput } from "../contracts";
import { RESEARCH_PROMPT_VERSION } from "../research/contracts";

type TraceDiagnostic =
  | "trace_initialization_failed"
  | "trace_export_failed"
  | "trace_flush_failed"
  | "trace_shutdown_failed"
  | "trace_sanitization_failed";
type Diagnose = (code: TraceDiagnostic) => void;
export type TraceProjection = {
  name: string;
  entityId: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
};
export type TraceProjections = Map<string, TraceProjection>;
type TraceMetadata = {
  runId?: string;
  mode: CatalogResearchInput["mode"];
  eventId?: string;
  model: string;
  promptVersion: string;
};

/** No SDK message, error or event payload reaches stderr. Bound repeats per run. */
function createDiagnostics(): Diagnose {
  const seen = new Set<TraceDiagnostic>();
  return (code) => {
    if (seen.has(code)) {
      return;
    }
    seen.add(code);
    try {
      process.stderr.write(`${code}\n`);
    } catch {
      // Diagnostics must not replace the research result, even with closed stderr.
    }
  };
}

class TraceLogger extends MastraLogger {
  constructor(private readonly failed: () => void) {
    super({ name: "catalog-tracing" });
  }
  debug() {}
  info() {}
  warn() {
    this.failed();
  }
  error() {
    this.failed();
  }
  override trackException() {
    this.failed();
  }
}

/** Drop notifications may contain raw error messages: deliberately ignore them. */
export class ResearchTraceExporter extends MastraStorageExporter {
  constructor(private readonly diagnose: Diagnose) {
    super({ maxRetries: 0, strategy: "insert-only" });
  }
  onDroppedEvent() {
    this.diagnose("trace_export_failed");
  }
  // LibSQL's observability domain stores spans only. Automatic metrics are out of scope.
  override async onMetricEvent() {}
}

function canonicalPath(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  const parent = dirname(path);
  return parent === path
    ? path
    : resolve(canonicalPath(parent), basename(path));
}

export function traceDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const path = resolve(
    cwd,
    env.CATALOG_TRACE_DATABASE_PATH?.trim() || "data/mastra-traces.sqlite",
  );
  const catalog = resolve(
    cwd,
    env.DATABASE_PATH?.trim() || "data/eventroam.sqlite",
  );
  if (canonicalPath(path) === canonicalPath(catalog)) {
    throw new Error("Trace storage must be separate from the catalog database");
  }
  return path;
}

export async function createTraceStore(env: NodeJS.ProcessEnv = process.env) {
  const path = traceDatabasePath(env);
  await mkdir(dirname(path), { recursive: true });
  return new LibSQLStore({
    id: "catalog-traces",
    url: pathToFileURL(path).href,
  });
}

const finishReasons = new Set([
  "stop",
  "length",
  "tool-calls",
  "tool_calls",
  "content-filter",
  "error",
  "other",
  "unknown",
  "retry",
]);
const numericAttributes = [
  "stepIndex",
  "maxSteps",
  "inputTokens",
  "outputTokens",
];
const usageFields = [
  "inputTokens",
  "outputTokens",
  "cacheRead",
  "cacheWrite",
  "text",
  "reasoning",
];

function numericFields(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    fields.flatMap((key) => {
      const number = record[key];
      return typeof number === "number" &&
        Number.isFinite(number) &&
        number >= 0
        ? [[key, number]]
        : [];
    }),
  );
}

/** An allowlist keeps new SDK fields private by default. Process every lifecycle event. */
export function researchSpanProcessor(
  metadata: TraceMetadata,
  diagnose: Diagnose,
  projections: TraceProjections = new Map(),
): SpanOutputProcessor {
  return {
    name: "catalog-content-exclusions",
    process(span?: AnySpan) {
      if (!span) {
        return undefined;
      }
      try {
        const attrs = span.attributes as Record<string, unknown> | undefined;
        const safe: Record<string, unknown> = numericFields(
          attrs,
          numericAttributes,
        );
        const usage = attrs?.usage as Record<string, unknown> | undefined;
        if (usage && typeof usage === "object") {
          safe.usage = {
            ...numericFields(usage, usageFields),
            inputDetails: numericFields(usage.inputDetails, usageFields),
            outputDetails: numericFields(usage.outputDetails, usageFields),
          };
        }
        if (typeof attrs?.success === "boolean") {
          safe.success = attrs.success;
        }
        if (
          typeof attrs?.finishReason === "string" &&
          finishReasons.has(attrs.finishReason)
        ) {
          safe.finishReason = attrs.finishReason;
        }
        if (span.type.startsWith("model_")) {
          safe.model = metadata.model;
        }
        if (typeof span.type !== "string" || typeof span.name !== "string") {
          throw new Error("Invalid span");
        }
        if (!Object.values(SpanType).includes(span.type)) {
          span.type = SpanType.GENERIC;
        }
        span.entityType = undefined;
        const stored = projections.get(span.id);
        const limit =
          stored?.entityId === "catalog-research"
            ? 16384 - Buffer.byteLength(JSON.stringify(metadata))
            : 8192;
        const projection = stored
          ? boundTraceProjection(stored, limit)
          : undefined;
        const tool = ["readSource", "discoverSources"].find(
          (name) => span.entityId === name,
        );
        span.name =
          projection?.name ??
          (span.type === "agent_run"
            ? "Festival research"
            : (tool ?? span.type));
        const rootId =
          span.type === "generic" && span.entityId === "catalog-research"
            ? "catalog-research"
            : undefined;
        span.entityId =
          projection?.entityId ??
          rootId ??
          (span.type === "agent_run" ? "festival-research" : tool);
        span.entityName = span.name;
        span.attributes = safe;
        span.metadata = { ...metadata, ...projection?.metadata };
        span.input = projection?.input;
        span.output = projection?.output;
        span.requestContext = undefined;
        span.tags = undefined;
        span.errorInfo = span.errorInfo
          ? { message: "operation_failed" }
          : undefined;
        return span;
      } catch {
        diagnose("trace_sanitization_failed");
        // Throwing lets the SDK continue with an unsafe span. Explicitly drop it.
        return undefined;
      }
    },
    async shutdown() {},
  };
}

export async function createResearchTracing(
  input: CatalogResearchInput,
  model: string,
  runId?: string,
) {
  if (process.env.CATALOG_TRACING !== "true" || input.dryRun) {
    return undefined;
  }
  const diagnose = createDiagnostics();
  let storage: LibSQLStore | undefined;
  let initializing = true;
  const logger = new TraceLogger(() =>
    diagnose(
      initializing ? "trace_initialization_failed" : "trace_export_failed",
    ),
  );
  try {
    storage = await createTraceStore();
    storage.__setLogger(logger);
    await storage.init();
    if (!(await storage.getStore("observability"))) {
      throw new Error("Trace storage unavailable");
    }
    const metadata: TraceMetadata = {
      ...(runId ? { runId } : {}),
      mode: input.mode,
      ...(input.eventId ? { eventId: traceText(input.eventId, 160) } : {}),
      model: traceText(model, 160),
      promptVersion: RESEARCH_PROMPT_VERSION,
    };
    const projections: TraceProjections = new Map();
    const processor = researchSpanProcessor(metadata, diagnose, projections);
    const observability = new Observability({
      sensitiveDataFilter: false,
      configs: {
        research: {
          serviceName: "eventroam-research",
          sampling: { type: SamplingStrategyType.ALWAYS },
          logging: { enabled: false },
          exporters: [new ResearchTraceExporter(diagnose)],
          spanOutputProcessors: [processor],
        },
      },
    });
    if (
      !observability
        .getDefaultInstance()
        ?.getSpanOutputProcessors()
        .includes(processor)
    ) {
      throw new Error("Mandatory processor unavailable");
    }
    initializing = false;
    return {
      storage,
      observability,
      logger,
      diagnose,
      projections,
      options: { hideInput: false, hideOutput: false, metadata },
    };
  } catch {
    diagnose("trace_initialization_failed");
    try {
      await storage?.close();
    } catch {
      diagnose("trace_shutdown_failed");
    }
    return undefined;
  }
}

export async function finishResearchTracing(
  mastra: Pick<Mastra, "observability" | "shutdown">,
  diagnose?: Diagnose,
) {
  if (!diagnose) {
    await mastra.shutdown();
    return;
  }
  // Core closes storage before observability.shutdown(), so flush explicitly first.
  try {
    await mastra.observability.flush();
  } catch {
    diagnose("trace_flush_failed");
  }
  try {
    await mastra.shutdown();
  } catch {
    diagnose("trace_shutdown_failed");
  }
}

/** Host projection updates and SDK instrumentation are always fail open. */
export function updateTrace(
  tracing: RunTracing | undefined,
  span: AnySpan | undefined,
  projection: TraceProjection,
) {
  if (!tracing || !span) {
    return;
  }
  try {
    tracing.projections.set(span.id, projection);
    span.update({ name: projection.name });
  } catch {
    tracing.diagnose("trace_export_failed");
  }
}
export async function createRunTracing(
  input: CatalogResearchInput,
  model: string,
  runId: string,
) {
  const tracing = await createResearchTracing(input, model, runId);
  if (!tracing) {
    return undefined;
  }
  let mastra: Mastra | undefined;
  try {
    mastra = new Mastra({
      logger: false,
      storage: tracing.storage,
      observability: tracing.observability,
    });
    tracing.observability.setLogger({ logger: tracing.logger });
    const root = tracing.observability.getDefaultInstance()!.startSpan({
      type: SpanType.GENERIC,
      name: "catalog-research",
      entityId: "catalog-research",
      tracingOptions: tracing.options,
    });
    return { ...tracing, mastra, root };
  } catch {
    tracing.diagnose("trace_initialization_failed");
    if (mastra) {
      await finishResearchTracing(mastra, tracing.diagnose);
    } else {
      try {
        await tracing.storage.close();
      } catch {
        tracing.diagnose("trace_shutdown_failed");
      }
    }
    return undefined;
  }
}
export type RunTracing = NonNullable<
  Awaited<ReturnType<typeof createRunTracing>>
>;
export function traceFailure(
  tracing: RunTracing | undefined,
  code: string,
  span: AnySpan | undefined = tracing?.root,
) {
  try {
    span?.error({ error: new Error(code), endSpan: false });
  } catch {
    tracing?.diagnose("trace_export_failed");
  }
}
export async function finishRunTracing(tracing?: RunTracing) {
  if (!tracing) {
    return;
  }
  try {
    tracing.root.end({ endTree: true });
  } catch {
    tracing.diagnose("trace_export_failed");
  }
  await finishResearchTracing(tracing.mastra, tracing.diagnose);
}

export function observeTrace(
  tracing: RunTracing | undefined,
  span: AnySpan | undefined,
  project: () => TraceProjection,
) {
  if (!tracing || !span) {
    return;
  }
  try {
    updateTrace(tracing, span, project());
  } catch {
    tracing.diagnose("trace_sanitization_failed");
  }
}
