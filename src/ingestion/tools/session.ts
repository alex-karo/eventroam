import type { ResearchLogger } from "../runtime/logging";
import { ResearchLimitError, type ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchDependencies } from "../contracts";
import { readPage } from "./read-page/read";
import { searchWeb, discoveryHttpStatus } from "./search-web/search";
import type { ReadPageResult } from "./read-page/contracts";
import type { SearchWebResult } from "./search-web/contracts";
import type { KnownSourceLink } from "./contracts";

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
  deps: Pick<ResearchDependencies, "readPage" | "searchWeb">,
  log?: ResearchLogger,
  ai?: { sessionId?: string },
) {
  const reads: ReadPageResult[] = [];
  const inFlight = new Map<string, Promise<ReadPageResult>>();
  const discovery: SearchWebResult[] = [];
  const read = async (
    url: string,
    operation: SourceLogContext & { tool?: boolean } = {},
    signal?: AbortSignal,
  ) => {
    const started = Date.now();
    const context = { stage: "source", ...operation };
    const operationLog = log?.child(context);
    if (!operation.tool) {
      operationLog?.info("Reading source", { attemptedUrl: url });
    }
    const finished = (result: ReadPageResult, cached: boolean) => {
      if (result.reasonCode?.endsWith("_budget_exhausted")) {
        operationLog?.warn("Research budget exhausted", {
          budgetKind: result.reasonCode.replace("_budget_exhausted", ""),
          remaining: budget.remaining(),
        });
      }
      if (!operation.tool) {
        operationLog?.[result.status === "ok" ? "info" : "warn"](
          "Source read finished",
          {
            attemptedUrl: url,
            response: { status: result.httpStatus, url: result.finalUrl },
            status: result.status,
            reasonCode: result.reasonCode,
            method: result.method,
            sourceCharacters: result.markdown.length,
            cached,
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
      const result = await (deps.readPage ?? readPage)(key, {
        budget,
        signal,
        log: operationLog,
      });
      reads.push(result);
      return result;
    })();
    inFlight.set(key, request);
    try {
      return finished(await request, false);
    } catch (error) {
      if (!operation.tool) {
        operationLog?.warn("Source read finished", {
          attemptedUrl: url,
          status: "failed",
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
    const finished = (result: SearchWebResult, status: string) => {
      if (!operation.tool) {
        operationLog?.info("Source discovery finished", {
          query,
          status,
          returnedCount: result.candidates.length,
          candidates: result.candidates.slice(0, 5).map(({ url }) => ({ url })),
          durationMs: Date.now() - started,
          remaining: budget.remaining(),
        });
      }
      return result;
    };
    let result: SearchWebResult;
    try {
      result = await (deps.searchWeb ?? searchWeb)(query, {
        budget,
        config,
        log: operationLog,
        ai: {
          ...ai,
          ...(operation.traceId ? { traceId: operation.traceId } : {}),
          ...(operation.spanId ? { parentId: operation.spanId } : {}),
        },
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
    return finished(result, "ok");
  };
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
    readPage: read,
    searchWeb: search,
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
