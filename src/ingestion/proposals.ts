import { atPath, setPath } from "./groups";
import { rejectedEdition, rejectedItem, type ReviewDecisions } from "./review";
import { normalizeProposedAssignments } from "@/catalog/domain/classification";
import type { ResearchContext } from "./research/context";
import type { CatalogResearchInput } from "./contracts";
import { editionSlotNames } from "./research/contracts";
import type { FrozenCorpus } from "./evidence/contracts";
import type {
  Targets,
  TicketsOutput,
  ClassificationOutput,
  LinksOutput,
  GeneralOutput,
} from "./roles/contracts";
import type { MaterializedLocation } from "./location/validate";
import type { RegisteredPoint } from "./location/contracts";
import {
  diagnosticsOnly,
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
export const initialDiagnostics = (): PlanDiagnostics => ({
  validation: { structural: "passed", target: "passed" },
  errors: [],
  unresolved: [],
  eventNameMismatch: null,
});
function reject(
  diagnostics: PlanDiagnostics,
  message: string,
  code:
    "invalid_plan" | "editor_rejected" | "country_conflict" = "invalid_plan",
  url?: string,
): StageResult<never> {
  return {
    status: "reject",
    diagnostics: {
      ...diagnosticsOnly(diagnostics),
      errors: [
        ...diagnostics.errors,
        {
          code,
          stage: code === "editor_rejected" ? "editor" : "validation",
          message,
          ...(url ? { url } : {}),
        },
      ],
    },
  };
}
function requireSupport(
  ids: string[],
  corpus: FrozenCorpus,
  allowEmpty = false,
) {
  if (
    (!allowEmpty && !ids.length) ||
    ids.some((id) => !corpus.evidence.some((item) => item.id === id))
  ) {
    throw new Error("Missing or unknown evidence reference");
  }
}

type SavedEvent = ResearchContext["catalog"][number];
export function checkRefreshCountries(
  output: GeneralOutput,
  mode: CatalogResearchInput["mode"],
  event: SavedEvent | undefined,
  corpus: FrozenCorpus,
) {
  if (
    mode !== "refresh" ||
    !("festivalCountries" in output) ||
    !output.festivalCountries?.length
  ) {
    return;
  }
  const diagnostics = initialDiagnostics();
  if (output.decision === "uncertain") {
    diagnostics.unresolved = output.unresolved;
  }
  for (const { countryCode, evidenceIds } of output.festivalCountries) {
    try {
      requireSupport(evidenceIds, corpus);
    } catch {
      return reject(
        diagnostics,
        "Festival country needs inspected source support",
      );
    }
    const saved = event?.editions.find(
      (edition) =>
        edition.countryCode &&
        edition.countryCode.toUpperCase() !== countryCode,
    );
    if (saved) {
      const evidence = corpus.evidence.find(
        (item) => item.id === evidenceIds[0],
      );
      const source = corpus.sources.find(
        (item) => item.id === evidence?.sourceId,
      );
      return reject(
        diagnostics,
        `Sources place the festival in ${countryCode}, but saved Edition ${saved.editionKey} has country ${saved.countryCode}. Confirm the saved country and correct it separately before retrying.`,
        "country_conflict",
        source?.finalUrl,
      );
    }
  }
}

function duplicateSupported(
  event: SavedEvent,
  ids: string[],
  corpus: FrozenCorpus,
) {
  const support = corpus.evidence.filter((item) => ids.includes(item.id));
  const name = event.canonicalName.trim().toLocaleLowerCase();
  if (support.some((item) => item.quote.toLocaleLowerCase().includes(name))) {
    return true;
  }
  const hosts = event.links
    .filter((link) => link.kind === "official_site")
    .map((link) => new URL(link.url).hostname.replace(/^www\./, ""));
  return support.some((item) => {
    const source = corpus.sources.find((source) => source.id === item.sourceId);
    return (
      !!source &&
      hosts.includes(new URL(source.finalUrl).hostname.replace(/^www\./, ""))
    );
  });
}
function validateTemporalTargets(
  output: Targets,
  event: SavedEvent | undefined,
  currentDate: string,
  corpus: FrozenCorpus,
) {
  for (const slot of editionSlotNames) {
    const target = output[slot];
    if (!target) {
      continue;
    }
    requireSupport(target.evidenceIds, corpus);
    const saved = event?.editions.find(
      (edition) => edition.editionKey === target.editionKey,
    );
    const dates = target.fields.dates;
    const selectedDates = dates?.action === "set" ? dates.value : saved;
    const startsOn = dates?.action === "clear" ? null : selectedDates?.startsOn;
    const endsOn = dates?.action === "clear" ? null : selectedDates?.endsOn;
    const day = saved?.timeZone
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: saved.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(currentDate))
      : currentDate.slice(0, 10);
    if (slot === "previousEdition" && endsOn && endsOn >= day) {
      throw new Error("Previous Edition has not completed");
    }
    if (slot === "currentOrNextEdition" && endsOn && endsOn < day) {
      throw new Error("Current or next Edition has ended");
    }
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new Error("Invalid target dates");
    }
  }
}

function hasEventFieldCheck(checks: Targets["checks"]) {
  return checks.some(
    ({ check }) => check === "description" || check === "eventLinks",
  );
}

function validateTargetAssignment(
  output: Targets,
  input: CatalogResearchInput,
) {
  if (
    input.scope === "current" &&
    (output.previousEdition || hasEventFieldCheck(output.checks))
  ) {
    throw new Error("Current refresh cannot address Event fields or history");
  }
  if (
    output.previousEdition?.editionKey ===
      output.currentOrNextEdition?.editionKey &&
    output.previousEdition
  ) {
    throw new Error("One Edition cannot occupy both roles");
  }
}
export function validateGeneral(
  output: GeneralOutput,
  context: ResearchContext,
  input: CatalogResearchInput,
  corpus: FrozenCorpus,
): StageResult<Targets & PlanDiagnostics> {
  const diagnostics = initialDiagnostics();
  const proposedEventId = "eventId" in output ? output.eventId : null;
  const event = context.catalog.find(
    ({ id }) => id === (input.eventId ?? proposedEventId),
  );
  if (proposedEventId && proposedEventId !== event?.id) {
    return reject(diagnostics, "Event is outside the assigned candidates");
  }
  const countryRejection = checkRefreshCountries(
    output,
    input.mode,
    event,
    corpus,
  );
  if (countryRejection) {
    return countryRejection;
  }
  if (output.decision === "uncertain") {
    return reject(
      { ...diagnostics, unresolved: output.unresolved },
      output.reason,
    );
  }
  diagnostics.matchedEventId = event?.id;
  if (event && output.observedEventName !== event.canonicalName) {
    diagnostics.eventNameMismatch = {
      eventId: event.id,
      storedName: event.canonicalName,
      observedName: output.observedEventName,
    };
  }
  try {
    requireSupport(output.evidenceIds, corpus);
  } catch {
    return reject(diagnostics, "Identity needs inspected source support");
  }
  if (output.decision === "duplicate") {
    if (input.mode !== "add" || !event) {
      return reject(diagnostics, "Invalid duplicate decision");
    }
    if (!duplicateSupported(event, output.evidenceIds, corpus)) {
      return reject(
        diagnostics,
        "Duplicate identity is not supported by the cited source",
      );
    }
    return { status: "skip", diagnostics };
  }
  if (input.mode === "add" && event) {
    return reject(
      diagnostics,
      "An existing Event requires an explicit duplicate decision",
    );
  }
  if (input.mode === "refresh" && !event) {
    return reject(diagnostics, "Refresh needs its saved Event");
  }
  try {
    validateTargetAssignment(output, input);
    validateTemporalTargets(output, event, context.currentDate, corpus);
  } catch (error) {
    return reject(
      diagnostics,
      error instanceof Error ? error.message : "Invalid temporal target",
    );
  }
  return {
    status: "continue",
    value: { ...output, ...diagnostics, unresolved: output.unresolved },
  };
}

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

function proposedChronology(
  target: Pick<EditionPlan, "fields"> | undefined,
  saved: SavedEvent["editions"][number] | undefined,
) {
  const dates = target?.fields.dates;
  const range = dates?.action === "set" ? dates.value : saved;
  const year = target?.fields.year;
  return {
    startsOn: dates?.action === "clear" ? null : (range?.startsOn ?? null),
    endsOn: dates?.action === "clear" ? null : (range?.endsOn ?? null),
    editionYear:
      year?.action === "set" ? year.value : (saved?.editionYear ?? null),
  };
}

function earlierEdition(
  donor: ReturnType<typeof proposedChronology> | undefined,
  target: ReturnType<typeof proposedChronology>,
) {
  if (!donor) {
    return false;
  }
  return donor.endsOn && target.startsOn
    ? donor.endsOn < target.startsOn
    : donor.editionYear != null &&
        target.editionYear != null &&
        donor.editionYear < target.editionYear;
}

export function checkedClassification(
  target: Pick<EditionPlan, "editionKey"> & {
    fields: NonNullable<Targets["currentOrNextEdition"]>["fields"];
  },
  classification: NonNullable<
    NonNullable<ClassificationOutput["currentOrNextEdition"]>["classification"]
  >,
  event: SavedEvent | undefined,
  context: ResearchContext,
  corpus: FrozenCorpus,
) {
  const saved = event?.editions.find(
    (edition) => edition.editionKey === target.editionKey,
  );
  const retained = new Set(saved?.terms.map((term) => term.id) ?? []);
  if (classification.reuseFrom) {
    const earlier = event?.editions.find(
      (edition) => edition.editionKey === classification.reuseFrom!.editionKey,
    );
    const chronology = proposedChronology(target, saved);
    if (!earlierEdition(earlier, chronology)) {
      throw new Error("Invalid classification reuse Edition");
    }
    requireSupport(classification.evidenceIds, corpus);
  } else if (
    classification.value.some((id) => !retained.has(id)) ||
    [...retained].some((id) => !classification.value.includes(id))
  ) {
    requireSupport(classification.evidenceIds, corpus);
  }
  const { retained: termIds, removed } = normalizeProposedAssignments(
    classification.value,
    context.terms,
  );
  const normalization = removed.length
    ? ` Removed selected ancestor terms ${removed.join(", ")}; retained descendant terms ${termIds.join(", ")}.`
    : "";
  return {
    ...classification,
    reason: classification.reason + normalization,
    value: termIds,
  };
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

export function assembleProposals(options: {
  targets: Targets & PlanDiagnostics;
  tickets: TicketsOutput | null;
  classification: ClassificationOutput | null;
  links: LinksOutput;
  location: MaterializedLocation;
  points: RegisteredPoint[];
  corpus: FrozenCorpus;
  context: ResearchContext;
  input: CatalogResearchInput;
  originalTargets?: Targets;
}): StageResult<PreparedProposals> {
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
    return reject(
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
    return reject(prepared, rejection.note, "editor_rejected");
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
    if (review.get(`${slot}.fields.location`)?.decision === "reject") {
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
  for (const { path, decision } of review.values()) {
    if (
      decision === "reject" &&
      path.includes(".fields.") &&
      !path.endsWith(".fields.location") &&
      atPath(accepted.plan, path) !== undefined
    ) {
      setPath(accepted.plan, path, undefined);
    }
  }
  discardRejectedDependencies(prepared, accepted, review);
  return { status: "continue", value: accepted };
}
