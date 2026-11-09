import type { CatalogResearchInput, ResearchDependencies } from "../contracts";
import type { FrozenCorpus } from "../evidence/contracts";
import type { GroupOwner } from "../groups";
import type { ResearchContext } from "../research/context";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { RunObservability } from "../runtime/observability/runtime";
import type { Role, RoleConversation } from "./invoke";
import type { Targets } from "./general/contracts";

export type RoleOptions = {
  input: CatalogResearchInput;
  context: ResearchContext;
  corpus: FrozenCorpus;
  budget: ResearchBudget;
  config: ResearchConfig;
  deps: ResearchDependencies;
  signal: AbortSignal;
  tracing?: RunObservability;
  capture?: (role: GroupOwner, conversation: RoleConversation) => void;
};

export function roleInvocationOptions(options: RoleOptions, role: Role) {
  return {
    budget: options.budget,
    config:
      (role === "editor" || role === "general") &&
      options.config.reasoningEffort === "low"
        ? { ...options.config, reasoningEffort: "medium" as const }
        : options.config,
    signal: options.signal,
    tracing: options.tracing,
    generate: options.deps.generateRoles?.[role] ?? options.deps.generateRole,
    capture: options.capture,
  };
}

export type SavedEdition =
  ResearchContext["catalog"][number]["editions"][number];

export function editionChronology(edition: SavedEdition) {
  return {
    editionKey: edition.editionKey,
    editionYear: edition.editionYear,
    startsOn: edition.startsOn,
    endsOn: edition.endsOn,
    scheduleStatus: edition.scheduleStatus,
  };
}

export function targetContext(
  options: RoleOptions,
  targets: Targets,
  projectSaved?: (edition: SavedEdition) => unknown,
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
    return {
      editionKey: selected.editionKey,
      reason: selected.reason,
      evidenceIds: selected.evidenceIds,
      fields: {
        year: selected.fields.year,
        dates: selected.fields.dates,
        scheduleStatus: selected.fields.scheduleStatus,
      },
      saved: saved ? projectSaved?.(saved) : null,
    };
  };
  return {
    identity: { name: targets.observedEventName, reason: targets.reason },
    currentDate: options.context.currentDate,
    previousEdition: target(targets.previousEdition),
    currentOrNextEdition: target(targets.currentOrNextEdition),
  };
}
