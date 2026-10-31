import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchDependencies } from "../contracts";
import type { SourceSession } from "../tools/session";
import type { RunObservability } from "../runtime/observability/runtime";
import { sourceUrlSchema } from "../tools/contracts";
import { bindEvidence, type FrozenCorpus, type Source } from "./contracts";
import { createCorpusStorage } from "./storage";
import { readSource } from "./reader";
import { pageLinks } from "./links";

export type EvidenceLimits = {
  readerCalls: number;
  pageInputCharacters: number;
  inputReserveCharacters: number;
  readerOutputTokens: number;
  downstreamReserveMs: number;
};
export function evidenceLimits(env = process.env): EvidenceLimits {
  const defaults: EvidenceLimits = {
    readerCalls: 18,
    pageInputCharacters: 360000,
    inputReserveCharacters: 72000,
    readerOutputTokens: 12000,
    downstreamReserveMs: 180000,
  };
  const names: Record<keyof EvidenceLimits, string> = {
    readerCalls: "CATALOG_READER_CALLS",
    pageInputCharacters: "CATALOG_READER_INPUT_CHARACTERS",
    inputReserveCharacters: "CATALOG_READER_RESERVE_CHARACTERS",
    readerOutputTokens: "CATALOG_READER_OUTPUT_TOKENS",
    downstreamReserveMs: "CATALOG_DOWNSTREAM_RESERVE_MS",
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
  const storage = createCorpusStorage(options.runId, options.root);
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
  const deadline =
    budget.deadline -
    Math.min(limits.downstreamReserveMs, budget.limits.durationMs / 2);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(Math.max(1, deadline - Date.now())),
  ]);
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
        collectionMs: Math.max(0, deadline - Date.now()),
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
        if (
          read.markdown.length + limits.inputReserveCharacters >
          limits.pageInputCharacters
        ) {
          source.limitations.push(
            "Whole page exceeds Reader input limit; no page portion was processed",
          );
        } else if (admittedCalls >= limits.readerCalls || signal.aborted) {
          source.limitations.push(
            "Reader allowance or collection time reached; whole page unprocessed",
          );
        } else {
          // Reserve synchronously before the model call so concurrent pages share one allowance.
          admittedCalls += 1;
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
            deadline,
            outputTokens: limits.readerOutputTokens,
          });
          source.readerResponse = execution.modelResponse;
          if (execution.status !== "success" || !execution.output) {
            source.processing = "failed";
            source.limitations.push(
              ...execution.errors.map((error) => error.message),
            );
            errors.push(...execution.errors);
            fatal = true;
          } else {
            const bound = bindEvidence(
              source.id,
              read.markdown,
              execution.output,
              read.finalUrl,
            );
            source.overview = execution.output.overview;
            source.topics = execution.output.topics;
            source.statedYears = execution.output.statedYears;
            source.limitations = bound.limitations;
            source.processing = bound.limitations.length
              ? "limited"
              : "complete";
            await storage.saveEvidence(source, bound.evidence);
          }
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
    deadline,
    navigationPages() {
      navigationStarted = true;
      return storage.sources.map(compact);
    },
    inspectPage,
    tool: createTool({
      id: "inspectPage",
      description:
        "Inspect one permitted source. Return a page overview, lead URLs and processing coverage. Independent URLs can be inspected in parallel.",
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
