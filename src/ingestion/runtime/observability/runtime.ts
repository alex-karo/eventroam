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
  researchLogLevel,
  createApplicationLogger,
  type ResearchLogLevel,
} from "../logging";
import { traceText } from "../tracing/labels";
import { createDiagnostics, type Diagnose } from "./diagnostics";
import { createObservabilityStore } from "./storage";

/** Keep metrics disabled when tracing is disabled. */
export class ResearchObservabilityExporter extends MastraStorageExporter {
  constructor(private readonly metricsEnabled = false) {
    super({ maxRetries: 0, strategy: "event-sourced" });
  }
  override async onMetricEvent(
    event: Parameters<MastraStorageExporter["onMetricEvent"]>[0],
  ) {
    if (!this.metricsEnabled) {
      return;
    }
    await super.onMetricEvent(event);
  }
}

export function createCatalogObservability(options: {
  traceEnabled: boolean;
  loggingEnabled: boolean;
  level: ResearchLogLevel;
}) {
  return new Observability({
    configs: {
      catalog: {
        serviceName: "eventroam-research",
        sampling: {
          type: options.traceEnabled
            ? SamplingStrategyType.ALWAYS
            : SamplingStrategyType.NEVER,
        },
        logging: { enabled: options.loggingEnabled, level: options.level },
        exporters: [new ResearchObservabilityExporter(options.traceEnabled)],
      },
    },
  });
}

export async function createResearchObservability(
  input: CatalogResearchInput,
  model: string,
  runId?: string,
  protectedPaths: string[] = [],
  sharedStore?: DuckDBStore,
  experimentId?: string,
) {
  const traceEnabled = process.env.CATALOG_TRACING === "true";
  const loggingEnabled = process.env.CATALOG_LOGGING === "true";
  if (!traceEnabled && !loggingEnabled) {
    return undefined;
  }
  const diagnose = createDiagnostics();
  let storage: DuckDBStore | undefined;
  const logger = createPinoLogger("warn", () => diagnose("log_write_failed"));
  try {
    const level = researchLogLevel(loggingEnabled);
    storage =
      sharedStore ??
      (await createObservabilityStore(process.env, protectedPaths));
    if (!sharedStore) {
      storage.__setLogger(logger);
      await storage.init();
    }
    if (!(await storage.getStore("observability"))) {
      throw new Error("Trace storage unavailable");
    }
    const metadata = {
      ...(runId ? { runId } : {}),
      ...(experimentId ? { experimentId } : {}),
      mode: input.mode,
      ...(input.eventId ? { eventId: traceText(input.eventId, 160) } : {}),
      model: traceText(model, 160),
      promptVersion: RESEARCH_PROMPT_VERSION,
    };
    const observability = createCatalogObservability({
      traceEnabled,
      loggingEnabled,
      level,
    });
    return {
      traceEnabled,
      loggingEnabled,
      level,
      storage,
      sharedStore: !!sharedStore,
      observability,
      logger,
      diagnose,
      options: { hideInput: false, hideOutput: false, metadata },
    };
  } catch {
    diagnose("trace_initialization_failed");
    try {
      if (!sharedStore) {
        await boundedCleanup(async () => storage?.close());
      }
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
  await flushObservability(mastra, diagnose);
  try {
    await boundedCleanup(() => mastra.shutdown());
  } catch {
    diagnose("trace_shutdown_failed");
  }
}

export async function flushObservability(
  mastra: Pick<Mastra, "observability">,
  diagnose: Diagnose,
) {
  // Core closes storage before observability.shutdown(), so flush explicitly first.
  try {
    await boundedCleanup(() => mastra.observability.flush());
  } catch {
    diagnose("trace_flush_failed");
  }
}

export async function createRunObservability(
  input: CatalogResearchInput,
  model: string,
  runId: string,
  protectedPaths: string[] = [],
  sharedStore?: DuckDBStore,
  experimentId?: string,
) {
  const tracing = await createResearchObservability(
    input,
    model,
    runId,
    protectedPaths,
    sharedStore,
    experimentId,
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
      logger: native ?? tracing.logger,
      loggerOptions: { export: tracing.loggingEnabled },
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
      ? createApplicationLogger({
          native,
          eventContext,
          runId,
          diagnose: tracing.diagnose,
        })
      : undefined;
    const setEventId = (eventId: string | null | undefined) => {
      if (!eventId || eventId === eventContext.eventId) {
        return;
      }
      eventContext.eventId = eventId;
      if (root) {
        try {
          root.update({ metadata: { ...root.metadata, eventId } });
        } catch {
          tracing.diagnose("trace_export_failed");
        }
      }
    };
    return { ...tracing, mastra, root, log, setEventId };
  } catch {
    tracing.diagnose("trace_initialization_failed");
    if (mastra) {
      if (tracing.sharedStore) {
        await shutdownSharedObservability(tracing);
      } else {
        await finishResearchObservability(mastra, tracing.diagnose);
      }
    } else {
      try {
        if (!tracing.sharedStore) {
          await boundedCleanup(() => tracing.storage.close());
        }
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
  if (tracing.sharedStore) {
    try {
      await boundedCleanup(() => tracing.observability.flush());
    } catch {
      tracing.diagnose("trace_flush_failed");
    }
    await shutdownSharedObservability(tracing);
  } else {
    await finishResearchObservability(tracing.mastra, tracing.diagnose);
  }
}

async function shutdownSharedObservability(tracing: {
  observability: Observability;
  diagnose: Diagnose;
}) {
  try {
    await boundedCleanup(() => tracing.observability.shutdown());
  } catch {
    tracing.diagnose("trace_shutdown_failed");
  }
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
