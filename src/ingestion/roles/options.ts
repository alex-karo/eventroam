import type { CatalogResearchInput, ResearchDependencies } from "../contracts";
import type { FrozenCorpus } from "../evidence/contracts";
import type { GroupOwner, ProposalGroup } from "../groups";
import type { SpecialistRole } from "../specialist-results";
import type { PlanDiagnostics } from "../stage";
import type { ResearchContext } from "../research/context";
import type { ResearchBudget } from "../runtime/budget";
import type { ResearchConfig } from "../runtime/config";
import type { RunObservability } from "../runtime/observability/runtime";
import type { Role, RoleConversation } from "./invoke";
import type { Targets } from "./general/contracts";

export type RoleRuntimeOptions = {
  budget: ResearchBudget;
  config: ResearchConfig;
  deps: ResearchDependencies;
  signal: AbortSignal;
  tracing?: RunObservability;
  capture?: (role: GroupOwner, conversation: RoleConversation) => void;
};

export type RoleOptions = RoleRuntimeOptions & {
  input: CatalogResearchInput;
  context: ResearchContext;
  corpus: FrozenCorpus;
};

export function roleInvocationOptions(options: RoleRuntimeOptions, role: Role) {
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

export type SavedEvent = ResearchContext["catalog"][number];
export type SavedEdition = SavedEvent["editions"][number];

export function resolveSavedEditions(
  event: SavedEvent | undefined,
  targets: Targets,
) {
  const savedEdition = (target: Targets["previousEdition"]) =>
    target && event
      ? event.editions.find(
          (edition) => edition.editionKey === target.editionKey,
        )
      : undefined;
  return {
    previousEdition: savedEdition(targets.previousEdition),
    currentOrNextEdition: savedEdition(targets.currentOrNextEdition),
  };
}

export type SpecialistContext = {
  scope: CatalogResearchInput["scope"];
  targets: Targets & PlanDiagnostics;
  savedEvent: SavedEvent | undefined;
  savedEditions: ReturnType<typeof resolveSavedEditions>;
  corpus: FrozenCorpus;
  currentDate: string;
  terms: ResearchContext["terms"];
  groups: readonly ProposalGroup[];
  specialists: readonly SpecialistRole[];
};

export function editionChronology(edition: SavedEdition) {
  return {
    editionKey: edition.editionKey,
    editionYear: edition.editionYear,
    startsOn: edition.startsOn,
    endsOn: edition.endsOn,
    scheduleStatus: edition.scheduleStatus,
  };
}

export function targetEditionContext(
  selected: Targets["previousEdition"],
  saved: SavedEdition | undefined,
  projectSaved?: (edition: SavedEdition) => unknown,
) {
  if (!selected) {
    return null;
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
    saved: saved ? projectSaved?.(saved) : null,
  };
}

export type TargetContextSelection = Pick<
  Targets,
  "observedEventName" | "reason" | "previousEdition" | "currentOrNextEdition"
>;

export function targetContext(
  targets: TargetContextSelection,
  savedEditions: SpecialistContext["savedEditions"],
  currentDate: string,
  projectSaved: (edition: SavedEdition) => unknown,
) {
  return {
    identity: { name: targets.observedEventName, reason: targets.reason },
    currentDate,
    previousEdition: targetEditionContext(
      targets.previousEdition,
      savedEditions.previousEdition,
      projectSaved,
    ),
    currentOrNextEdition: targetEditionContext(
      targets.currentOrNextEdition,
      savedEditions.currentOrNextEdition,
      projectSaved,
    ),
  };
}
