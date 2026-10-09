import type { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import type { CatalogResearchInput } from "../contracts";
import {
  RESEARCH_PROMPT_VERSION,
  TICKET_PROMPT_VERSION,
} from "../research/contracts";
import {
  createResearchTracing,
  finishResearchTracing,
  type RunTracing,
} from "./tracing";

/** One lazy Mastra for the two concrete agents. The host owns execution and cleanup. */
export function createResearchRuntime(
  input: CatalogResearchInput,
  model: string,
  runId?: string,
  getRunTracing?: () => Promise<RunTracing | undefined>,
) {
  let runTracing: RunTracing | undefined;
  let resources:
    | Promise<{
        mastra: Mastra;
        tracing: Awaited<ReturnType<typeof createResearchTracing>>;
      }>
    | undefined;
  function get() {
    resources ??= (async () => {
      runTracing = await getRunTracing?.();
      const tracing =
        runTracing ??
        (getRunTracing
          ? undefined
          : await createResearchTracing(input, model, runId));
      const mastra =
        runTracing?.mastra ??
        new Mastra({
          logger: false,
          storage: tracing?.storage,
          observability: tracing?.observability,
        });
      tracing?.observability.setLogger({ logger: tracing.logger });
      return { mastra, tracing };
    })();
    return resources;
  }
  async function attach(
    agent: Agent,
    key: "festivalResearch" | "ticketResearch",
    promptVersion: string,
  ) {
    const { mastra, tracing } = await get();
    mastra.addAgent(agent, key);
    return {
      agent: mastra.getAgent(key),
      tracingContext: runTracing ? { currentSpan: runTracing.root } : undefined,
      tracingOptions: tracing
        ? {
            ...tracing.options,
            metadata: { ...tracing.options.metadata, promptVersion },
          }
        : undefined,
    };
  }
  return {
    get tracing() {
      return runTracing;
    },
    main: (agent: Agent) =>
      attach(agent, "festivalResearch", RESEARCH_PROMPT_VERSION),
    tickets: (agent: Agent) =>
      attach(agent, "ticketResearch", TICKET_PROMPT_VERSION),
    async finish() {
      if (resources && !runTracing) {
        try {
          const { mastra, tracing } = await resources;
          await finishResearchTracing(mastra, tracing?.diagnose);
        } catch {
          // A failed initialization has no runtime to close; preserve its generation error.
        }
      }
    },
  };
}
export type ResearchRuntime = ReturnType<typeof createResearchRuntime>;
