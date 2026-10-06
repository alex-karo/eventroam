import { ResearchLimitError, type ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { ResearchDependencies } from "../contracts";
import { readSource } from "./read-source";
import { discoverSources } from "./discover-sources";
import type {
  ReadSourceResult,
  DiscoverSourcesResult,
  KnownSourceLink,
} from "./contracts";

/** Source state belongs to one run; every request uses its original budget. */
export function createSourceSession(
  budget: ResearchBudget,
  config: ResearchConfig,
  knownLinks: KnownSourceLink[],
  deps: Pick<ResearchDependencies, "readSource" | "discoverSources">,
) {
  const reads: ReadSourceResult[] = [];
  const inFlight = new Map<string, Promise<ReadSourceResult>>();
  const depthByUrl = new Map<string, number>();
  const discovery: DiscoverSourcesResult[] = [];
  const read = async (url: string) => {
    const key = new URL(url).toString();
    const prior = reads.find(
      (item) => item.attemptedUrl === key || item.finalUrl === key,
    );
    if (prior) return prior;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const depth = depthByUrl.get(key) ?? 1;
    const request = (async () => {
      const result = await (deps.readSource ?? readSource)(key, {
        budget,
        depth,
      });
      reads.push(result);
      for (const url of result.links)
        if (!depthByUrl.has(url))
          depthByUrl.set(url, Math.min(depth + 1, budget.limits.depth + 1));
      return result;
    })();
    inFlight.set(key, request);
    try {
      return await request;
    } finally {
      inFlight.delete(key);
    }
  };
  const search = async (query: string) => {
    const reservedResult = () => ({
      query,
      candidates: [],
      retrievedAt: new Date().toISOString(),
      modelCostUsd: null,
      searchCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    if (budget.remaining().modelCalls <= 1) return reservedResult();
    let result: DiscoverSourcesResult;
    try {
      result = await (deps.discoverSources ?? discoverSources)(query, {
        budget: {
          ...budget,
          consumeModelCall: (inputChars) => {
            if (budget.remaining().modelCalls <= 1)
              throw new ResearchLimitError("modelCalls");
            budget.consumeModelCall(inputChars);
          },
        },
        config,
      });
    } catch (error) {
      if (error instanceof ResearchLimitError && error.limit === "modelCalls")
        return reservedResult();
      throw error;
    }
    discovery.push(result);
    for (const lead of result.candidates)
      if (!depthByUrl.has(lead.url)) depthByUrl.set(lead.url, 0);
    return result;
  };
  for (const { url } of knownLinks) depthByUrl.set(new URL(url).toString(), 0);
  async function readInitialSource() {
    const initialUrl =
      knownLinks.find((link) => link.kind === "official_site")?.url ??
      knownLinks.find((link) => link.official)?.url ??
      knownLinks[0]?.url;
    if (initialUrl) {
      try {
        await read(initialUrl);
      } catch (error) {
        if (!(error instanceof ResearchLimitError)) throw error;
      }
    }
  }
  return {
    reads,
    discovery,
    readSource: read,
    discoverSources: search,
    readInitialSource,
  };
}

export type SourceSession = ReturnType<typeof createSourceSession>;
