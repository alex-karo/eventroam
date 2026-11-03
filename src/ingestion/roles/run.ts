import { normalizeRoleWire } from "./wire";
import {
  searchWebInputSchema,
  searchWebOutputSchema,
} from "../tools/search-web/contracts";
import { createTool } from "@mastra/core/tools";
import {
  Workspace,
  LocalFilesystem,
  createWorkspaceTools,
  WORKSPACE_TOOLS,
} from "@mastra/core/workspace";
import { basename, dirname } from "node:path";
import { z } from "zod";
import type { CatalogResearchInput, ResearchDependencies } from "../contracts";
import type { ResearchContext } from "../research/context";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { RunObservability } from "../runtime/observability/runtime";
import type { Collection } from "../evidence/collection";
import {
  evidencePacket,
  topics,
  type FrozenCorpus,
} from "../evidence/contracts";
import { readCanonicalSource } from "../evidence/storage";
import { buildAssignment, assignedRoleChecks } from "./assignment";
import {
  roleEvidenceTopics,
  collectionOutputSchema,
  generalOutputSchema,
  refreshGeneralOutputSchema,
  ticketsOutputSchema,
  classificationOutputSchema,
  linksOutputSchema,
  type Targets,
} from "./contracts";
import {
  researchInstructions,
  generalInstructions,
  ticketsInstructions,
  classificationInstructions,
  linksInstructions,
  editorInstructions,
} from "./prompts";
import { invokeRole } from "./invoke";
import { reviewSchema, type PreparedProposals } from "../proposals";

export type RoleOptions = {
  input: CatalogResearchInput;
  context: ResearchContext;
  corpus: FrozenCorpus;
  budget: ResearchBudget;
  config: ResearchConfig;
  deps: ResearchDependencies;
  signal: AbortSignal;
  tracing?: RunObservability;
};
import { PROMPT_VERSIONS } from "./versions";

export async function collectResearch(
  options: Omit<RoleOptions, "corpus"> & {
    collection: Collection;
    sourceSession: import("../tools/session").SourceSession;
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
      const result = await options.sourceSession.searchWeb(query, correlation);
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
    normalizeOutput: (value: unknown) => normalizeRoleWire("research", value),
    budget: options.budget,
    config:
      options.config.reasoningEffort === "low"
        ? { ...options.config, reasoningEffort: "medium" as const }
        : options.config,
    signal: options.collection.signal,
    deadline: options.collection.deadline,
    tracing: options.tracing,
    generate: options.deps.generateRoles?.research ?? options.deps.generateRole,
    tools: { inspectPage: options.collection.tool, searchWeb: search },
    steps: options.budget.limits.agentSteps,
  });
}
function base(options: RoleOptions, role: import("./invoke").Role) {
  return {
    normalizeOutput: (value: unknown) => normalizeRoleWire(role, value),
    budget: options.budget,
    config:
      (role === "editor" || role === "general") &&
      options.config.reasoningEffort === "low"
        ? { ...options.config, reasoningEffort: "medium" as const }
        : options.config,
    signal: options.signal,
    tracing: options.tracing,
    generate: options.deps.generateRoles?.[role] ?? options.deps.generateRole,
  };
}
export function runGeneral(options: RoleOptions) {
  const { identityTask, identityContext, currentDate, permissions } =
    buildAssignment(options.input, options.context);
  return invokeRole({
    ...base(options, "general"),
    role: "general",
    version: PROMPT_VERSIONS.general,
    instructions: generalInstructions,
    input: {
      assignment: { identityTask, identityContext, currentDate, permissions },
      assignedChecks: assignedRoleChecks("general", options.input),
      candidates: options.context.catalog.map((event) => ({
        id: event.id,
        canonicalName: event.canonicalName,
        aliases: event.aliases,
        summary: event.summary,
        version: event.version,
        publicationState: event.publicationState,
        links: event.links
          .filter((link) => link.official)
          .map(({ kind, url }) => ({ kind, url })),
        editions: event.editions.map((edition) => ({
          ...editionChronology(edition),
          id: edition.id,
          eventId: edition.eventId,
          version: edition.version,
          displayName: edition.displayName,
          dateState: edition.dateState,
          timeZone: edition.timeZone,
          sizeEstimate: edition.sizeEstimate,
          countryCode: edition.countryCode,
          locality: edition.locality,
          venueName: edition.venueName,
          venueAddress: edition.venueAddress,
          publicationState: edition.publicationState,
        })),
      })),
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.general),
    },
    schema:
      options.input.mode === "refresh"
        ? refreshGeneralOutputSchema
        : generalOutputSchema,
  });
}
type SavedEdition = ResearchContext["catalog"][number]["editions"][number];
function editionChronology(edition: SavedEdition) {
  return {
    editionKey: edition.editionKey,
    editionYear: edition.editionYear,
    startsOn: edition.startsOn,
    endsOn: edition.endsOn,
    scheduleStatus: edition.scheduleStatus,
  };
}
function classificationHistory(edition: SavedEdition) {
  return { ...editionChronology(edition), terms: edition.terms };
}
function targetContext(
  options: RoleOptions,
  targets: Targets,
  role: "tickets" | "classification" | "links",
) {
  const event = options.context.catalog.find(
    (event) => event.id === (options.input.eventId ?? targets.eventId),
  );
  const target = (selected: Targets["previousEdition"]) => {
    if (!selected) {
      return null;
    }
    const saved = event?.editions.find(
      (edition) => edition.editionKey === selected.editionKey,
    );
    let savedFields: unknown;
    if (saved && role === "classification") {
      savedFields = classificationHistory(saved);
    } else if (saved && role === "links") {
      savedFields = { ...editionChronology(saved), links: saved.links };
    } else if (!saved) {
      savedFields = null;
    }
    return {
      editionKey: selected.editionKey,
      reason: selected.reason,
      evidenceIds: selected.evidenceIds,
      fields: {
        year: selected.fields.year,
        dates: selected.fields.dates,
        scheduleStatus: selected.fields.scheduleStatus,
      },
      saved: savedFields,
    };
  };
  return {
    identity: { name: targets.observedEventName, reason: targets.reason },
    currentDate: options.context.currentDate,
    previousEdition: target(targets.previousEdition),
    currentOrNextEdition: target(targets.currentOrNextEdition),
  };
}
export function runTickets(options: RoleOptions, targets: Targets) {
  const selected = targetContext(
    options,
    targets,
    "tickets",
  ).currentOrNextEdition;
  const saved = options.context.catalog
    .find((event) => event.id === (options.input.eventId ?? targets.eventId))
    ?.editions.find((edition) => edition.editionKey === selected?.editionKey);
  return invokeRole({
    ...base(options, "tickets"),
    role: "tickets",
    version: PROMPT_VERSIONS.tickets,
    instructions: ticketsInstructions,
    input: {
      assignedChecks: assignedRoleChecks("tickets", options.input, targets),
      target: selected
        ? {
            ...selected,
            saved: {
              ...(saved ? editionChronology(saved) : {}),
              priceDetails: saved?.priceDetails.map((offer) =>
                Object.fromEntries(
                  Object.entries(offer).filter(([key]) => key !== "url"),
                ),
              ),
              basePrice: saved
                ? {
                    kind: saved.priceKind,
                    currency: saved.priceCurrency,
                    minMinor: saved.priceMinMinor,
                    maxMinor: saved.priceMaxMinor,
                  }
                : null,
            },
          }
        : null,
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.tickets),
    },
    schema: ticketsOutputSchema,
  });
}
export function runClassification(options: RoleOptions, targets: Targets) {
  return invokeRole({
    ...base(options, "classification"),
    role: "classification",
    version: PROMPT_VERSIONS.classification,
    instructions: classificationInstructions,
    input: {
      assignedChecks: assignedRoleChecks(
        "classification",
        options.input,
        targets,
      ),
      targets: targetContext(options, targets, "classification"),
      history: options.context.catalog
        .find(
          (event) => event.id === (options.input.eventId ?? targets.eventId),
        )
        ?.editions.map(classificationHistory),
      vocabulary: options.context.terms,
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.classification),
    },
    schema: classificationOutputSchema.extend({
      previousEdition: targets.previousEdition
        ? classificationOutputSchema.shape.previousEdition
        : z.null(),
      currentOrNextEdition: targets.currentOrNextEdition
        ? classificationOutputSchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
}
export function runLinks(options: RoleOptions, targets: Targets) {
  return invokeRole({
    ...base(options, "links"),
    role: "links",
    version: PROMPT_VERSIONS.links,
    instructions: linksInstructions,
    input: {
      assignedChecks: assignedRoleChecks("links", options.input, targets),
      targets: targetContext(options, targets, "links"),
      permissions: buildAssignment(options.input, options.context).permissions,
      savedEventLinks: options.context.catalog.find(
        (event) => event.id === (options.input.eventId ?? targets.eventId),
      )?.links,
      corpus: evidencePacket(options.corpus, roleEvidenceTopics.links, {
        anchors: true,
      }),
    },
    schema: linksOutputSchema.extend({
      event: buildAssignment(options.input, options.context).permissions
        .eventFields
        ? linksOutputSchema.shape.event
        : z.strictObject({ socials: z.strictObject({}) }),
      currentOrNextEdition: targets.currentOrNextEdition
        ? linksOutputSchema.shape.currentOrNextEdition
        : z.null(),
    }),
  });
}
export async function runEditor(
  options: RoleOptions,
  prepared: PreparedProposals,
) {
  const sources = options.corpus.sources.filter((source) =>
    Boolean(source.markdownPath),
  );
  const sourceFiles = sources.map((source) => ({
    sourceId: source.id,
    path: basename(source.markdownPath!),
    url: source.finalUrl,
    overview: source.overview ?? null,
  }));
  const tools = sources.length
    ? await createWorkspaceTools(
        new Workspace({
          filesystem: new LocalFilesystem({
            basePath: dirname(sources[0].markdownPath!),
            readOnly: true,
          }),
          tools: {
            enabled: false,
            [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true },
            hooks: {
              beforeToolCall: async ({ input }) => {
                options.signal.throwIfAborted();
                const { path } = input as { path: string };
                const source = sources.find(
                  (source) => basename(source.markdownPath!) === path,
                );
                if (!source) {
                  throw new Error("Source file is not saved in this run");
                }
                await readCanonicalSource(source);
              },
            },
          },
        }),
      )
    : {};
  return invokeRole({
    ...base(options, "editor"),
    role: "editor",
    version: PROMPT_VERSIONS.editor,
    instructions: editorInstructions,
    input: {
      currentDate: options.context.currentDate,
      permissions: buildAssignment(options.input, options.context).permissions,
      sourceFiles,
      vocabulary: options.context.terms,
      prepared: {
        ...prepared,
        targets: undefined,
        identity: {
          eventId: prepared.targets.eventId,
          observedEventName: prepared.targets.observedEventName,
          reason: prepared.targets.reason,
          evidenceIds: prepared.targets.evidenceIds,
        },
        basis: {
          ...prepared.basis,
          evidence: evidencePacket(
            { ...options.corpus, evidence: prepared.basis.evidence },
            topics,
            { anchors: true },
          ).evidence,
        },
      },
    },
    schema: reviewSchema(prepared),
    tools,
    steps: 6,
  });
}
