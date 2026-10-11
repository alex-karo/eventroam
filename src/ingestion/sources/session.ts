import type { ResearchLogger } from "../runtime/logging";
import { ResearchLimitError, type ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchDependencies } from "../contracts";
import { readSource } from "./read-source";
import { discoverSources, discoveryHttpStatus } from "./discover-sources";
import type {
  ReadSourceResult,
  DiscoverSourcesResult,
  KnownSourceLink,
} from "./contracts";

export type SourceLogContext = {
  stage?: string;
  step?: number;
  attempt?: number;
  toolCallId?: string;
  traceId?: string;
  spanId?: string;
};

/** Source state belongs to one run; every request uses its original budget. */
export function createSourceSession(
  budget: ResearchBudget,
  config: ResearchConfig,
  knownLinks: KnownSourceLink[],
  deps: Pick<ResearchDependencies, "readSource" | "discoverSources">,
  log?: ResearchLogger,
) {
  const reads: ReadSourceResult[] = [];
  const inFlight = new Map<string, Promise<ReadSourceResult>>();
  const depthByUrl = new Map<string, number>();
  const discovery: DiscoverSourcesResult[] = [];
  const read = async (
    url: string,
    operation: SourceLogContext & { tool?: boolean } = {},
  ) => {
    const started = Date.now();
    const context = { stage: "source", ...operation };
    const operationLog = log?.child(context);
    const depth = depthByUrl.get(new URL(url).toString()) ?? 1;
    if (!operation.tool) {
      operationLog?.info("Reading source", { attemptedUrl: url, depth });
    }
    const finished = (result: ReadSourceResult, cached: boolean) => {
      if (result.reason?.endsWith("_budget_exhausted")) {
        operationLog?.warn("Research budget exhausted", {
          budgetKind: result.reason.replace("_budget_exhausted", ""),
          remaining: budget.remaining(),
        });
      }
      if (!operation.tool) {
        operationLog?.[result.outcome === "ok" ? "info" : "warn"](
          "Source read finished",
          {
            attemptedUrl: url,
            response: { status: result.httpStatus, url: result.finalUrl },
            outcome: result.outcome,
            reason: result.reason,
            method: result.method,
            completeness: result.completeness,
            sourceCharacters: result.markdown.length,
            sourceTruncated: result.sourceTruncated,
            cached,
            depth,
            durationMs: Date.now() - started,
            remaining: budget.remaining(),
          },
        );
      }
      return result;
    };
    const key = new URL(url).toString();
    const prior = reads.find(
      (item) => item.attemptedUrl === key || item.finalUrl === key,
    );
    if (prior) {
      operationLog?.debug("Reusing cached or in-flight source", {
        attemptedUrl: url,
        reuse: "cache",
      });
      return finished(prior, true);
    }
    const pending = inFlight.get(key);
    if (pending) {
      operationLog?.debug("Reusing cached or in-flight source", {
        attemptedUrl: url,
        reuse: "in_flight",
      });
      return finished(await pending, true);
    }
    const request = (async () => {
      const result = await (deps.readSource ?? readSource)(key, {
        budget,
        depth,
        log: operationLog,
      });
      reads.push(result);
      for (const url of result.links) {
        if (!depthByUrl.has(url)) {
          depthByUrl.set(url, Math.min(depth + 1, budget.limits.depth + 1));
        }
      }
      return result;
    })();
    inFlight.set(key, request);
    try {
      return finished(await request, false);
    } catch (error) {
      if (!operation.tool) {
        operationLog?.warn("Source read finished", {
          attemptedUrl: url,
          outcome: "failed",
          durationMs: Date.now() - started,
        });
      }
      if (error instanceof ResearchLimitError) {
        operationLog?.warn("Research budget exhausted", {
          budgetKind: error.limit,
        });
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  };
  const search = async (
    query: string,
    operation: SourceLogContext & { tool?: boolean } = {},
  ) => {
    const started = Date.now();
    const context = { stage: "discovery", ...operation };
    const operationLog = log?.child(context);
    if (!operation.tool) {
      operationLog?.info("Discovering sources", { query });
    }
    const finished = (result: DiscoverSourcesResult, status: string) => {
      if (!operation.tool) {
        operationLog?.info("Source discovery finished", {
          query,
          status,
          returnedCount: result.candidates.length,
          candidates: result.candidates.slice(0, 5).map(({ url }) => ({ url })),
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          modelCostUsd: result.modelCostUsd,
          searchCostUsd: result.searchCostUsd,
          durationMs: Date.now() - started,
          remaining: budget.remaining(),
        });
      }
      return result;
    };
    let result: DiscoverSourcesResult;
    try {
      result = await (deps.discoverSources ?? discoverSources)(query, {
        budget,
        config,
        log: operationLog,
      });
    } catch (error) {
      if (!operation.tool) {
        operationLog?.warn("Source discovery finished", {
          query,
          status: "failed",
          httpStatus: discoveryHttpStatus(error),
        });
      }
      if (error instanceof ResearchLimitError) {
        operationLog?.warn("Research budget exhausted", {
          budgetKind: error.limit,
        });
      }
      throw error;
    }
    discovery.push(result);
    for (const lead of result.candidates) {
      if (!depthByUrl.has(lead.url)) {
        depthByUrl.set(lead.url, 0);
      }
    }
    return finished(result, "ok");
  };
  for (const { url } of knownLinks) {
    depthByUrl.set(new URL(url).toString(), 0);
  }
  const initialUrl =
    knownLinks.find((link) => link.kind === "official_site")?.url ??
    knownLinks.find((link) => link.official)?.url ??
    knownLinks[0]?.url;
  async function readInitialSource(operation: SourceLogContext = {}) {
    if (initialUrl) {
      try {
        await read(initialUrl, operation);
      } catch (error) {
        if (!(error instanceof ResearchLimitError)) {
          throw error;
        }
      }
    }
  }
  return {
    reads,
    discovery,
    readSource: read,
    discoverSources: search,
    readInitialSource,
    initialUrl,
    isReadCached: (url: string) => {
      const key = new URL(url).toString();
      return (
        inFlight.has(key) ||
        reads.some((item) => item.attemptedUrl === key || item.finalUrl === key)
      );
    },
  };
}

export type SourceSession = ReturnType<typeof createSourceSession>;
