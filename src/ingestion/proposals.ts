import { hasEventFieldCheck } from "./roles/assignment";
import { earlierEdition, proposedChronology } from "./research/guards";
import { atPath, locationGroupPath, proposalGroups, setPath } from "./groups";
import { requireSupport, type FrozenCorpus } from "./evidence/contracts";
import type { ResearchContext } from "./research/context";
import type { CatalogResearchInput } from "./contracts";
import { editionSlotNames } from "./research/contracts";
import type { ClassificationOutput } from "./roles/classification/contracts";
import { checkedClassification } from "./roles/classification/validate";
import type { ReviewDecisions } from "./roles/editor/contracts";
import { rejectedEdition, rejectedItem } from "./roles/editor/review";
import type { Targets } from "./roles/general/contracts";
import type { LinksOutput } from "./roles/links/contracts";
import type { MaterializedLocation } from "./roles/location/validate";
import type { RegisteredPoint } from "./roles/location/contracts";
import type { TicketsOutput } from "./roles/tickets/contracts";
import {
  diagnosticsOnly,
  rejectProposal,
  type PlanDiagnostics,
  type StageResult,
} from "./stage";
type LinkFields = LinksOutput["event"];
type DescriptionFields = Pick<
  ClassificationOutput,
  "description" | "shortDescription"
>;
type EditionFields = NonNullable<Targets["currentOrNextEdition"]>["fields"] &
  TicketsOutput["currentOrNextEdition"] &
  NonNullable<ClassificationOutput["currentOrNextEdition"]> & {
    links?: NonNullable<LinksOutput["currentOrNextEdition"]>;
  };
type EditionPlan = {
  editionKey: string;
  reason?: string;
  fields: EditionFields;
};
/** Host application values after proposal validation. No model result contract. */
export type ApplicationPlan = {
  status: "ready";
  event: {
    reason?: string;
    fields: DescriptionFields & { links?: LinkFields };
  } | null;
  previousEdition: EditionPlan | null;
  currentOrNextEdition: EditionPlan | null;
  unresolved: { message: string; editionKey?: string; field?: string }[];
};
export type PreparedProposals = PlanDiagnostics & {
  eventName: string;
  plan: ApplicationPlan;
  location: MaterializedLocation;
  targets: Targets;
  basis: {
    savedEvent: ResearchContext["catalog"][number] | null;
    evidence: FrozenCorpus["evidence"];
    points: RegisteredPoint[];
  };
};
export type AcceptedProposals = Omit<PreparedProposals, "basis">;
function inspectProposalSupport(
  value: unknown,
  corpus: FrozenCorpus,
  cited: Set<string>,
) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((part) => inspectProposalSupport(part, corpus, cited));
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.evidenceIds)) {
    requireSupport(record.evidenceIds as string[], corpus, true);
    (record.evidenceIds as string[]).forEach((id) => cited.add(id));
  }
  if (record.action === "clear" || record.action === "set") {
    requireSupport(
      (record.evidenceIds ?? []) as string[],
      corpus,
      !!record.reuseFrom || Array.isArray(record.value),
    );
  }
  Object.values(record).forEach((part) =>
    inspectProposalSupport(part, corpus, cited),
  );
}

function validateLocationSupport(
  location: MaterializedLocation,
  points: RegisteredPoint[],
  corpus: FrozenCorpus,
) {
  for (const slot of editionSlotNames) {
    const fields = location.slots[slot];
    if (!fields) {
      continue;
    }
    const changedText = Object.entries(fields).some(
      ([field, action]) => field !== "coordinates" && action.action !== "keep",
    );
    const locationOutput = points
      .filter((point) => point.kind === "source")
      .flatMap((point) => point.evidenceIds ?? []);
    requireSupport(location.support[slot] ?? [], corpus, !changedText);
    locationOutput.forEach((id) => requireSupport([id], corpus));
  }
}
function eventFields(
  classification: ClassificationOutput | null,
  links: LinksOutput,
  scope: CatalogResearchInput["scope"],
): NonNullable<ApplicationPlan["event"]>["fields"] {
  const { description, shortDescription } = classification ?? {};
  if (scope !== "current") {
    return {
      ...(description && { description }),
      ...(shortDescription && { shortDescription }),
      links: links.event,
    };
  }
  if (
    description ||
    shortDescription ||
    (classification && hasEventFieldCheck(classification.checks))
  ) {
    throw new Error("Current refresh cannot address Event descriptions");
  }
  if (
    links.event.website ||
    Object.keys(links.event.socials).length ||
    hasEventFieldCheck(links.checks)
  ) {
    throw new Error("Event links are outside the assignment");
  }
  return {};
}

export type SpecialistOutputs = {
  tickets: TicketsOutput | null;
  classification: ClassificationOutput | null;
  links: LinksOutput;
};

export function assembleProposals(
  options: SpecialistOutputs & {
    targets: Targets & PlanDiagnostics;
    location: MaterializedLocation;
    points: RegisteredPoint[];
    corpus: FrozenCorpus;
    context: ResearchContext;
    input: CatalogResearchInput;
    originalTargets?: Targets;
  },
): StageResult<PreparedProposals> {
  const { targets, corpus, context, input } = options;
  const diagnostics: PlanDiagnostics = {
    ...diagnosticsOnly(targets),
    unresolved: [
      ...targets.unresolved,
      ...(options.tickets?.unresolved ?? []),
      ...(options.classification?.unresolved ?? []),
      ...options.links.unresolved,
      ...options.location.unresolved,
    ],
  };
  const event =
    context.catalog.find((event) => event.id === targets.eventId) ??
    (input.eventId ? context.catalog[0] : undefined);
  const submitted = {
    general: targets,
    tickets: options.tickets,
    classification: options.classification,
    links: options.links,
  };
  try {
    const cited = new Set(Object.values(options.location.support).flat());
    inspectProposalSupport(submitted, corpus, cited);
    validateLocationSupport(options.location, options.points, corpus);
    if (
      !targets.currentOrNextEdition &&
      (options.tickets || options.links.currentOrNextEdition)
    ) {
      throw new Error("Proposal for an absent target");
    }
    const plan: ApplicationPlan = {
      status: "ready",
      event: {
        reason: targets.reason,
        fields: eventFields(options.classification, options.links, input.scope),
      },
      previousEdition: structuredClone(targets.previousEdition),
      currentOrNextEdition: structuredClone(targets.currentOrNextEdition),
      unresolved: diagnostics.unresolved,
    };
    for (const slot of editionSlotNames) {
      const target = plan[slot];
      const classification = options.classification?.[slot]?.classification;
      if (!target) {
        if (classification || options.location.slots[slot]) {
          throw new Error("Proposal for an absent target");
        }
        continue;
      }
      if (slot === "currentOrNextEdition") {
        target.fields.tickets = options.tickets?.currentOrNextEdition.tickets;
        target.fields.links = options.links.currentOrNextEdition
          ? { tickets: options.links.currentOrNextEdition.tickets }
          : undefined;
      }
      if (classification) {
        target.fields.classification = checkedClassification(
          options.originalTargets?.[slot] ?? target,
          classification,
          event,
          context,
          corpus,
        );
      }
    }
    return {
      status: "continue",
      value: {
        ...diagnostics,
        eventName: targets.observedEventName,
        targets,
        plan,
        location: options.location,
        basis: {
          savedEvent: event ?? null,
          evidence: corpus.evidence.filter((item) => cited.has(item.id)),
          points: options.points,
        },
      },
    };
  } catch (error) {
    return rejectProposal(
      diagnostics,
      error instanceof Error ? error.message : "Invalid proposals",
    );
  }
}

function discardRejectedDependencies(
  prepared: PreparedProposals,
  accepted: AcceptedProposals,
  review: ReviewDecisions,
) {
  const rejected = new Set<string>();
  const rejectedTargets = new Set<string>();
  for (const slot of editionSlotNames) {
    const source = prepared.plan[slot];
    if (source && !accepted.plan[slot]) {
      rejectedTargets.add(source.editionKey);
    }
    if (
      source &&
      (!accepted.plan[slot] ||
        review.get(`${slot}.fields.classification`)?.decision === "reject")
    ) {
      rejected.add(source.editionKey);
    }
  }
  const saved = prepared.basis.savedEvent?.editions ?? [];
  const proposed = editionSlotNames.flatMap(
    (slot) => accepted.plan[slot] ?? [],
  );
  const chronology = (key: string) => {
    const edition = saved.find((item) => item.editionKey === key);
    return edition
      ? proposedChronology(
          proposed.find((item) => item.editionKey === key),
          edition,
        )
      : undefined;
  };
  for (const slot of editionSlotNames) {
    const target = accepted.plan[slot];
    const dates = proposedChronology(
      target ?? undefined,
      saved.find((item) => item.editionKey === target?.editionKey),
    );
    const classification = target?.fields.classification;
    if (
      classification?.action === "set" &&
      classification.reuseFrom &&
      (rejected.has(classification.reuseFrom.editionKey) ||
        !earlierEdition(chronology(classification.reuseFrom.editionKey), dates))
    ) {
      delete accepted.plan[slot]!.fields.classification;
    }
    const reused = accepted.location.reusedFrom?.[slot];
    if (!reused?.editionKey) {
      continue;
    }
    const donor = chronology(reused.editionKey);
    if (
      !rejectedTargets.has(reused.editionKey) &&
      (!donor || earlierEdition(donor, dates))
    ) {
      continue;
    }
    const fields = accepted.location.slots[slot];
    if (fields) {
      accepted.location.slots[slot] = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          {
            action: "keep",
            reason: "The reviewed earlier Edition premise no longer applies",
          },
        ]),
      ) as typeof fields;
    }
    delete accepted.location.reusedFrom![slot];
  }
  const active = new Set(
    Object.values(accepted.location.reusedFrom ?? {}).map((point) => point.id),
  );
  accepted.location.previousPoints = accepted.location.previousPoints.filter(
    (point) => active.has(point.id),
  );
}

export function applyReview(
  prepared: PreparedProposals,
  review: ReviewDecisions,
): StageResult<AcceptedProposals> {
  const rejection = rejectedItem(review);
  if (rejection) {
    return rejectProposal(prepared, rejection.note, "editor_rejected");
  }
  const accepted: AcceptedProposals = structuredClone({
    ...diagnosticsOnly(prepared),
    eventName: prepared.eventName,
    targets: prepared.targets,
    plan: prepared.plan,
    location: prepared.location,
  });
  for (const slot of editionSlotNames) {
    if (rejectedEdition(review, slot)) {
      accepted.plan[slot] = null;
      delete accepted.location.slots[slot];
      continue;
    }
    if (review.get(locationGroupPath(slot))?.decision === "reject") {
      const old = accepted.location.slots[slot];
      if (old) {
        accepted.location.slots[slot] = Object.fromEntries(
          Object.keys(old).map((key) => [
            key,
            {
              action: "keep",
              reason: "Editor rejected proposed place changes",
            },
          ]),
        ) as typeof old;
      }
      delete accepted.location.reusedFrom?.[slot];
    }
  }
  for (const { owner, path } of proposalGroups) {
    if (
      owner !== "location" &&
      review.get(path)?.decision === "reject" &&
      atPath(accepted.plan, path) !== undefined
    ) {
      setPath(accepted.plan, path, undefined);
    }
  }
  discardRejectedDependencies(prepared, accepted, review);
  return { status: "continue", value: accepted };
}
