import { Mastra } from "@mastra/core/mastra";
import { SpanType } from "@mastra/core/observability";
import type { DuckDBStore } from "@mastra/duckdb";
import {
  MastraStorageExporter,
  Observability,
  SamplingStrategyType,
} from "@mastra/observability";
import type { CatalogResearchInput } from "../../contracts";
import { RESEARCH_PROMPT_VERSION } from "../../research/contracts";
import {
  createPinoLogger,
  createResearchLogger,
  type ResearchLogLevel,
} from "../logging";
import { traceText } from "../tracing/labels";
import {
  researchSpanProcessor,
  type TraceMetadata,
} from "../tracing/processor";
import {
  createDiagnostics,
  ObservabilityLogger,
  type Diagnose,
} from "./diagnostics";
import { createObservabilityStore } from "./storage";

/** Drop notifications may contain raw error messages: deliberately ignore them. */
export class ResearchObservabilityExporter extends MastraStorageExporter {
  constructor(private readonly diagnose: Diagnose) {
    super({ maxRetries: 0, strategy: "event-sourced" });
  }
  override async onLogEvent(
    event: Parameters<MastraStorageExporter["onLogEvent"]>[0],
  ) {
    if (event.log.metadata?.catalogApplicationLog === true) {
      await super.onLogEvent({
        ...event,
        log: { ...event.log, metadata: undefined },
      });
    }
  }
  onDroppedEvent() {
    this.diagnose("trace_export_failed");
  }
  // Automatic metrics are out of scope.
  override async onMetricEvent() {}
}

export async function createResearchObservability(
  input: CatalogResearchInput,
  model: string,
  runId?: string,
  injected = false,
  protectedPaths: string[] = [],
) {
  const traceEnabled =
    process.env.CATALOG_TRACING === "true" && !input.dryRun && !injected;
  const loggingEnabled = process.env.CATALOG_LOGGING === "true";
  if (!traceEnabled && !loggingEnabled) {
    return undefined;
  }
  const diagnose = createDiagnostics();
  let storage: DuckDBStore | undefined;
  let initializing = true;
  const logger = new ObservabilityLogger(() =>
    diagnose(
      initializing ? "trace_initialization_failed" : "trace_export_failed",
    ),
  );
  try {
    const level = loggingEnabled
      ? process.env.CATALOG_LOG_LEVEL?.trim() || "info"
      : "info";
    if (!["debug", "info", "warn", "error"].includes(level)) {
      throw new Error("Invalid log level");
    }
    storage = await createObservabilityStore(process.env, protectedPaths);
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
    const processor = researchSpanProcessor(metadata, diagnose);
    const observability = new Observability({
      sensitiveDataFilter: false,
      configs: {
        research: {
          serviceName: "eventroam-research",
          sampling: {
            type: traceEnabled
              ? SamplingStrategyType.ALWAYS
              : SamplingStrategyType.NEVER,
          },
          logging: {
            enabled: loggingEnabled,
            level: level as ResearchLogLevel,
          },
          exporters: [new ResearchObservabilityExporter(diagnose)],
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
      traceEnabled,
      loggingEnabled,
      level: level as ResearchLogLevel,
      storage,
      observability,
      logger,
      diagnose,
      options: { hideInput: false, hideOutput: false, metadata },
    };
  } catch {
    diagnose("trace_initialization_failed");
    try {
      await boundedCleanup(async () => storage?.close());
    } catch {
      diagnose("trace_shutdown_failed");
    }
    return undefined;
  }
}

export async function finishResearchObservability(
  mastra: Pick<Mastra, "observability" | "shutdown">,
  diagnose?: Diagnose,
) {
  if (!diagnose) {
    await boundedCleanup(() => mastra.shutdown());
    return;
  }
  // Core closes storage before observability.shutdown(), so flush explicitly first.
  try {
    await boundedCleanup(() => mastra.observability.flush());
  } catch {
    diagnose("trace_flush_failed");
  }
  try {
    await boundedCleanup(() => mastra.shutdown());
  } catch {
    diagnose("trace_shutdown_failed");
  }
}

export async function createRunObservability(
  input: CatalogResearchInput,
  model: string,
  runId: string,
  injected = false,
  protectedPaths: string[] = [],
) {
  const tracing = await createResearchObservability(
    input,
    model,
    runId,
    injected,
    protectedPaths,
  );
  if (!tracing) {
    return undefined;
  }
  let mastra: Mastra | undefined;
  try {
    const native = tracing.loggingEnabled
      ? createPinoLogger(tracing.level, () =>
          tracing.diagnose("log_write_failed"),
        )
      : undefined;
    const eventContext: { eventId?: string } = input.eventId
      ? { eventId: input.eventId }
      : {};
    mastra = new Mastra({
      logger: native?.child({ runId, ...eventContext }) ?? false,
      loggerOptions: { export: false },
      storage: tracing.storage,
      observability: tracing.observability,
    });
    tracing.observability.setLogger({ logger: tracing.logger });
    const root = tracing.traceEnabled
      ? tracing.observability.getDefaultInstance()!.startSpan({
          type: SpanType.GENERIC,
          name: "catalog-research",
          entityId: "catalog-research",
          tracingOptions: tracing.options,
        })
      : undefined;
    const log = native
      ? createResearchLogger({
          native,
          eventContext,
          observability: tracing.observability,
          runId,
          level: tracing.level,
          root,
          diagnose: tracing.diagnose,
        })
      : undefined;
    const instance = mastra;
    const setEventId = (eventId: string | null | undefined) => {
      if (!eventId || eventId === eventContext.eventId) {
        return;
      }
      eventContext.eventId = eventId;
      if (native) {
        try {
          instance.setLogger({
            logger: native.child({ runId, ...eventContext }),
          });
          tracing.observability.setLogger({ logger: tracing.logger });
        } catch {
          tracing.diagnose("log_write_failed");
        }
      }
    };
    return { ...tracing, mastra, root, log, setEventId };
  } catch {
    tracing.diagnose("trace_initialization_failed");
    if (mastra) {
      await finishResearchObservability(mastra, tracing.diagnose);
    } else {
      try {
        await boundedCleanup(() => tracing.storage.close());
      } catch {
        tracing.diagnose("trace_shutdown_failed");
      }
    }
    return undefined;
  }
}
export type RunObservability = NonNullable<
  Awaited<ReturnType<typeof createRunObservability>>
>;
export async function finishRunObservability(tracing?: RunObservability) {
  if (!tracing) {
    return;
  }
  try {
    tracing.root?.end({ endTree: true });
  } catch {
    tracing.diagnose("trace_export_failed");
  }
  await finishResearchObservability(tracing.mastra, tracing.diagnose);
}

const CLEANUP_DEADLINE_MS = 2000;
async function boundedCleanup(action: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      action(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("cleanup_timeout")),
          CLEANUP_DEADLINE_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
