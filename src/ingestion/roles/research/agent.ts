import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { Collection } from "../../evidence/collection";
import type { SourceSession } from "../../tools/session";
import {
  searchWebInputSchema,
  searchWebOutputSchema,
} from "../../tools/search-web/contracts";
import { buildAssignment } from "../assignment";
import { invokeRole } from "../invoke";
import type { RoleOptions } from "../options";
import { PROMPT_VERSIONS } from "../versions";
import { collectionOutputSchema } from "./contracts";
import { researchInstructions } from "./prompt";

export async function collectResearch(
  options: Omit<RoleOptions, "corpus"> & {
    collection: Collection;
    sourceSession: SourceSession;
  },
) {
  const assignment = buildAssignment(options.input, options.context);
  const search = createTool({
    id: "searchWeb",
    description:
      "Discover sources only when the assignment permits discovery. Search is bounded by the shared allowance.",
    inputSchema: searchWebInputSchema,
    outputSchema: z.union([
      searchWebOutputSchema,
      z.strictObject({ outcome: z.literal("not_permitted") }),
    ]),
    execute: async ({ query }, context) => {
      if (!assignment.sourcePolicy.discoveryAllowed) {
        return { outcome: "not_permitted" as const };
      }
      options.collection.signal.throwIfAborted();
      const span = context?.tracingContext?.currentSpan;
      const correlation = {
        stage: "source",
        tool: true,
        toolCallId: context?.agent?.toolCallId,
        ...(span?.isValid ? { traceId: span.traceId, spanId: span.id } : {}),
      };
      const log = options.tracing?.log?.child(correlation);
      log?.info("Tool call started", { tool: "searchWeb", query });
      const result = await options.sourceSession.searchWeb(
        query,
        correlation,
        span?.isValid && options.tracing
          ? { parent: span, diagnose: options.tracing.diagnose }
          : undefined,
      );
      log?.info("Tool call finished", {
        tool: "searchWeb",
        candidateCount: result.candidates.length,
      });
      return { ...result, remaining: options.budget.remaining() };
    },
  });
  return invokeRole({
    role: "research",
    version: PROMPT_VERSIONS.research,
    instructions: researchInstructions,
    input: {
      ...assignment,
      inspectedPages: options.collection.navigationPages(),
      remaining: options.budget.remaining(),
    },
    schema: collectionOutputSchema,
    budget: options.budget,
    config:
      options.config.reasoningEffort === "low"
        ? { ...options.config, reasoningEffort: "medium" as const }
        : options.config,
    signal: options.collection.signal,
    tracing: options.tracing,
    generate: options.deps.generateRoles?.research ?? options.deps.generateRole,
    tools: { inspectPage: options.collection.tool, searchWeb: search },
    steps: options.budget.limits.agentSteps,
  });
}
