import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchDependencies } from "../contracts";
import type { SourceSession } from "../tools/session";
import type { RunObservability } from "../runtime/observability/runtime";
import { sourceUrlSchema } from "../tools/contracts";
import type { FrozenCorpus, Source } from "./contracts";
import { createCorpusStorage } from "./storage";
import { readSource } from "../roles/reader/agent";
import { pageLinks } from "./links";

export type EvidenceLimits = {
  readerCalls: number;
  pageInputCharacters: number;
  inputReserveCharacters: number;
  readerOutputTokens: number;
};
export function evidenceLimits(env = process.env): EvidenceLimits {
  const defaults: EvidenceLimits = {
    readerCalls: 18,
    pageInputCharacters: 360000,
    inputReserveCharacters: 72000,
    readerOutputTokens: 12000,
  };
  const names: Record<keyof EvidenceLimits, string> = {
    readerCalls: "CATALOG_READER_CALLS",
    pageInputCharacters: "CATALOG_READER_INPUT_CHARACTERS",
    inputReserveCharacters: "CATALOG_READER_RESERVE_CHARACTERS",
    readerOutputTokens: "CATALOG_READER_OUTPUT_TOKENS",
  };
  for (const key of Object.keys(defaults) as (keyof EvidenceLimits)[]) {
    if (!env[names[key]]) {
      continue;
    }
    const value = Number(env[names[key]]);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${names[key]}`);
    }
    defaults[key] = value;
  }
  return defaults;
}
export function createCollection(options: {
  runId: string;
  startedAt: number;
  sources: SourceSession;
  budget: ResearchBudget;
  config: ResearchConfig;
  deps: Pick<ResearchDependencies, "generateRole" | "generateRoles">;
  assignment: unknown;
  signal?: AbortSignal;
  tracing?: RunObservability;
  root?: string;
  limits?: EvidenceLimits;
}) {
  const { sources, budget } = options;
  const limits = options.limits ?? evidenceLimits();
  const storage = createCorpusStorage(
    options.runId,
    options.startedAt,
    options.root,
  );
  const pending = new Map<string, Promise<Source>>();
  const canonical = new Map<string, Promise<Source>>();
  const cache = new Map<string, Source>();
  let admittedCalls = 0;
  let closed = false;
  let fatal = false;
  let frozen: Promise<FrozenCorpus> | undefined;
  let navigationStarted = false;
  const shownLeads = new Set<string>();
  const errors: import("../research/contracts").ResearchError[] = [];
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(Math.max(1, budget.deadline - Date.now())),
  ]);
  function reserveReaderCall() {
    if (admittedCalls >= limits.readerCalls || signal.aborted) {
      return false;
    }
    // Reserve synchronously so parallel inspections share one allowance.
    admittedCalls += 1;
    return true;
  }
  function compact(source: Source) {
    const leads = (source.leads ?? []).filter((lead) => {
      if (!navigationStarted) {
        return true;
      }
      const key = JSON.stringify([lead.url, lead.label]);
      if (shownLeads.has(key)) {
        return false;
      }
      shownLeads.add(key);
      return true;
    });
    return {
      sourceId: source.id,
      attemptedUrl: source.attemptedUrl,
      finalUrl: source.finalUrl,
      overview: source.overview ?? null,
      coverage: source.coverage ?? null,
      retrieval: source.status,
      reasonCode: source.reasonCode ?? null,
      processing: source.processing,
      limitations: source.limitations,
      leads,
      topics: source.topics ?? [],
      statedYears: source.statedYears ?? [],
      remaining: {
        ...budget.remaining(),
        readerCalls: Math.max(0, limits.readerCalls - admittedCalls),
      },
    };
  }
  async function inspectPage(url: string) {
    if (closed) {
      throw new Error("Collection is closed");
    }
    signal.throwIfAborted();
    const key = sourceUrlSchema.parse(url);
    const cached = cache.get(key);
    if (cached) {
      return compact(cached);
    }
    const prior = pending.get(key);
    if (prior) {
      return compact(await prior);
    }
    const work = (async () => {
      const read = await sources.readPage(key, {}, signal);
      signal.throwIfAborted();
      const finalKey = read.finalUrl;
      const existing = cache.get(finalKey);
      if (existing) {
        return existing;
      }
      const finalPending = canonical.get(finalKey);
      if (finalPending) {
        return finalPending;
      }
      const process = (async () => {
        const source = await storage.savePage(read);
        if (read.status !== "ok") {
          return source;
        }
        source.leads = pageLinks(read.markdown, read.finalUrl);
        const execution = await readSource({
          input: {
            assignment: options.assignment,
            source: { id: source.id, ...read, markdown: undefined },
            page: read.markdown,
          },
          budget,
          config: options.config,
          signal,
          tracing: options.tracing,
          generate:
            options.deps.generateRoles?.reader ?? options.deps.generateRole,
          outputTokens: limits.readerOutputTokens,
          inputLimits: limits,
          reserveCall: reserveReaderCall,
          reserveCorrection: reserveReaderCall,
        });
        if (execution.skipReason) {
          source.limitations.push(execution.skipReason);
          return source;
        }
        source.readerResponse = execution.modelResponse;
        if (!execution.bound || !execution.output) {
          source.processing = "failed";
          source.limitations.push(
            ...execution.errors.map((error) => error.message),
          );
          errors.push(...execution.errors);
          fatal = true;
        } else {
          const { bound, output } = execution;
          source.overview = output.overview;
          source.coverage = output.coverage;
          source.topics = output.topics;
          source.statedYears = output.statedYears;
          source.limitations = bound.limitations;
          source.processing = bound.limitations.length ? "limited" : "complete";
          await storage.saveEvidence(source, bound.evidence);
        }
        return source;
      })();
      canonical.set(finalKey, process);
      const source = await process;
      cache.set(finalKey, source);
      return source;
    })();
    pending.set(key, work);
    try {
      const source = await work;
      cache.set(key, source);
      return compact(source);
    } catch (error) {
      if (!signal.aborted) {
        fatal = true;
      }
      throw error;
    } finally {
      pending.delete(key);
    }
  }
  return {
    errors,
    sources: storage.sources,
    limits,
    signal,
    navigationPages() {
      navigationStarted = true;
      return storage.sources.map(compact);
    },
    inspectPage,
    tool: createTool({
      id: "inspectPage",
      description:
        "Inspect one permitted source. Return a page overview, page-local coverage, lead URLs and processing limits. Independent URLs can be inspected in parallel.",
      inputSchema: z.strictObject({ url: sourceUrlSchema }),
      outputSchema: z.json(),
      execute: async ({ url }, context) => {
        const span = context?.tracingContext?.currentSpan;
        const log = options.tracing?.log?.child({
          stage: "source",
          toolCallId: context?.agent?.toolCallId,
          ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
        });
        log?.info("Tool call started", {
          tool: "inspectPage",
          attemptedUrl: url,
        });
        try {
          const result = await inspectPage(url);
          log?.info("Tool call finished", {
            tool: "inspectPage",
            attemptedUrl: url,
            status: result.retrieval,
            processing: result.processing,
            remaining: result.remaining,
          });
          return JSON.parse(JSON.stringify(result)) as z.infer<
            ReturnType<typeof z.json>
          >;
        } catch (error) {
          log?.warn("Tool call failed", {
            tool: "inspectPage",
            attemptedUrl: url,
            errorCode: "source_failed",
          });
          throw error;
        }
      },
    }),
    get fatal() {
      return fatal;
    },
    freeze(): Promise<FrozenCorpus> {
      closed = true;
      frozen ??= (async () => {
        await Promise.allSettled([...pending.values()]);
        controller.abort();
        return storage.freeze();
      })();
      return frozen;
    },
  };
}
export type Collection = ReturnType<typeof createCollection>;
