import { z } from "zod";
import { validateTermAssignments } from "@/catalog/domain/validation";
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
import { reasonSchema, questionsSchema } from "./roles/contracts";
import type { MaterializedLocation } from "./location/validate";
import type { RegisteredPoint } from "./location/contracts";
import {
  diagnosticsOnly,
  type PlanDiagnostics,
  type StageResult,
} from "./stage";

type PlanAction<T> =
  | {
      action: "set";
      value: T;
      reason: string;
      evidenceIds?: string[];
      reuseFrom?: { editionKey: string; reason: string };
    }
  | { action: "keep" | "clear"; reason: string };
type LinkFields = {
  website?: PlanAction<string>;
  socials?: Partial<
    Record<
      "instagram" | "facebook" | "youtube" | "tiktok" | "x" | "other",
      PlanAction<string>
    >
  >;
};
type EditionFields = {
  year?: PlanAction<number>;
  dates?: PlanAction<{
    startsOn: string;
    endsOn: string;
    state: "confirmed" | "provisional";
  }>;
  scheduleStatus?: PlanAction<
    "announced" | "scheduled" | "postponed" | "cancelled"
  >;
  displayName?: PlanAction<string>;
  sizeEstimate?: PlanAction<number>;
  tickets?: PlanAction<
    z.infer<typeof import("./roles/contracts").ticketBlockSchema>
  >;
  classification?: PlanAction<string[]>;
  links?: { tickets?: PlanAction<string> };
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
    fields: { summary?: PlanAction<string>; links?: LinkFields };
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
    proposals: unknown;
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
  code: "invalid_plan" | "editor_rejected" = "invalid_plan",
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

function validateTargetAssignment(
  output: Targets,
  input: CatalogResearchInput,
) {
  if (
    input.scope === "current" &&
    (output.previousEdition || Object.keys(output.event).length)
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
  if (output.decision === "uncertain") {
    return reject(
      { ...diagnostics, unresolved: output.unresolved },
      output.reason,
    );
  }
  const event = context.catalog.find(
    (event) => event.id === (output.eventId ?? input.eventId),
  );
  if (
    (output.eventId && !event) ||
    (input.eventId && output.eventId && input.eventId !== output.eventId)
  ) {
    return reject(diagnostics, "Event is outside the assigned candidates");
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

export function commonPlan(targets: Targets): ApplicationPlan {
  return {
    status: "ready",
    event: { reason: targets.reason, fields: { ...targets.event } },
    previousEdition: targets.previousEdition
      ? structuredClone(targets.previousEdition)
      : null,
    currentOrNextEdition: targets.currentOrNextEdition
      ? structuredClone(targets.currentOrNextEdition)
      : null,
    unresolved: targets.unresolved,
  };
}

function inspectProposalSupport(value: unknown, corpus: FrozenCorpus) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((part) => inspectProposalSupport(part, corpus));
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.evidenceIds)) {
    requireSupport(record.evidenceIds as string[], corpus, true);
  }
  if (record.action === "clear" || record.action === "set") {
    requireSupport(
      (record.evidenceIds ?? []) as string[],
      corpus,
      !!record.reuseFrom || Array.isArray(record.value),
    );
  }
  Object.values(record).forEach((part) => inspectProposalSupport(part, corpus));
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

function selectedAncestors(
  terms: ResearchContext["terms"],
  selectedIds: string[],
  vocabulary: ResearchContext["terms"],
) {
  const selected = new Set(selectedIds);
  const ancestors = new Set<string>();
  for (const term of terms) {
    const seen = new Set<string>();
    let parent = term.parentId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      if (selected.has(parent)) {
        ancestors.add(parent);
      }
      parent = vocabulary.find((term) => term.id === parent)?.parentId ?? null;
    }
  }
  return ancestors;
}
function attachClassification(
  target: EditionPlan,
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
    const dateAction = target.fields.dates;
    let targetDates = dateAction?.action === "set" ? dateAction.value : saved;
    if (dateAction?.action === "clear") {
      targetDates = undefined;
    }
    const targetYear = target.fields.year;
    const year =
      targetYear?.action === "set" ? targetYear.value : saved?.editionYear;
    const earlierByDates =
      earlier?.endsOn && targetDates?.startsOn
        ? earlier.endsOn < targetDates.startsOn
        : null;
    const earlierByYear =
      earlier?.editionYear != null &&
      year != null &&
      earlier.editionYear < year;
    if (!earlier || !(earlierByDates ?? earlierByYear)) {
      throw new Error("Invalid classification reuse Edition");
    }
    requireSupport(classification.evidenceIds, corpus);
  } else if (
    classification.value.some((id) => !retained.has(id)) ||
    [...retained].some((id) => !classification.value.includes(id))
  ) {
    requireSupport(classification.evidenceIds, corpus);
  }
  const terms = classification.value.map((id) => {
    const term = context.terms.find((term) => term.id === id);
    if (!term) {
      throw new Error("Unknown classification term");
    }
    return term;
  });
  if (new Set(classification.value).size !== classification.value.length) {
    throw new Error("Duplicate classification term");
  }
  validateTermAssignments(terms);
  const ancestors = selectedAncestors(
    terms,
    classification.value,
    context.terms,
  );
  const normalization = ancestors.size
    ? ` Removed selected ancestor terms ${[...ancestors].join(", ")}; retained descendant terms ${classification.value.filter((id) => !ancestors.has(id)).join(", ")}.`
    : "";
  target.fields.classification = {
    ...classification,
    reason: classification.reason + normalization,
    value: classification.value.filter((id) => !ancestors.has(id)),
  };
}

function citedEvidence(submitted: unknown, location: MaterializedLocation) {
  const cited = new Set<string>();
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.evidenceIds)) {
      (obj.evidenceIds as string[]).forEach((id) => cited.add(id));
    }
    Object.values(obj).forEach(collect);
  };
  collect(submitted);
  Object.values(location.support)
    .flat()
    .forEach((id) => cited.add(id));
  return cited;
}

function assignEventLinks(
  plan: ApplicationPlan,
  links: LinksOutput,
  input: CatalogResearchInput,
) {
  if (input.scope !== "current") {
    plan.event!.fields.links = links.event;
  } else if (
    Object.keys(links.event.website ?? {}).length ||
    Object.keys(links.event.socials).length
  ) {
    throw new Error("Event links are outside the assignment");
  }
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
}): StageResult<PreparedProposals> {
  const { targets, corpus, context, input } = options;
  const diagnostics: PlanDiagnostics = diagnosticsOnly(targets);
  const event =
    context.catalog.find((event) => event.id === targets.eventId) ??
    (input.eventId ? context.catalog[0] : undefined);
  const plan = commonPlan(targets);
  const submitted = {
    general: targets,
    tickets: options.tickets,
    classification: options.classification,
    links: options.links,
  };
  try {
    inspectProposalSupport(submitted, corpus);
    validateLocationSupport(options.location, options.points, corpus);
    if (
      !targets.currentOrNextEdition &&
      (options.tickets || options.links.currentOrNextEdition)
    ) {
      throw new Error("Proposal for an absent target");
    }
    assignEventLinks(plan, options.links, input);
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
        attachClassification(target, classification, event, context, corpus);
      }
    }
    const cited = citedEvidence(submitted, options.location);
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
          proposals: submitted,
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

const decision = z.strictObject({
  decision: z.enum(["approve", "reject"]),
  reason: reasonSchema,
});
/** Decisions mirror submitted fixed fields; no addresses or replacement values. */
export function reviewSchema(prepared: PreparedProposals) {
  function fields(value: unknown): z.ZodType {
    if (!value || typeof value !== "object") {
      throw new Error("Invalid proposal fields");
    }
    const entries = Object.entries(value).filter(
      ([, value]) => value !== undefined,
    );
    return z.strictObject(
      Object.fromEntries(
        entries.map(([key, value]) => [
          key,
          value && typeof value === "object" && "action" in value
            ? decision
            : fields(value),
        ]),
      ),
    );
  }
  const target = (slot: (typeof editionSlotNames)[number]) =>
    prepared.plan[slot]
      ? z.strictObject({
          target: decision,
          fields: fields({
            ...prepared.plan[slot].fields,
            ...(prepared.location.slots[slot]
              ? { location: { action: "review" } }
              : {}),
          }),
        })
      : z.null();
  return z.strictObject({
    item: decision,
    event: z.strictObject({
      target: decision,
      fields: fields(prepared.plan.event!.fields),
    }),
    previousEdition: target("previousEdition"),
    currentOrNextEdition: target("currentOrNextEdition"),
    unresolved: questionsSchema,
  });
}

function discardRejectedDependencies(
  prepared: PreparedProposals,
  accepted: AcceptedProposals,
  review: Record<string, unknown>,
) {
  const rejected = new Set<string>();
  for (const slot of editionSlotNames) {
    const source = prepared.plan[slot];
    const decision = review[slot] as {
      fields?: { classification?: { decision: string } };
    } | null;
    if (
      source &&
      (!accepted.plan[slot] ||
        decision?.fields?.classification?.decision === "reject")
    ) {
      rejected.add(source.editionKey);
    }
  }
  for (const slot of editionSlotNames) {
    const classification = accepted.plan[slot]?.fields.classification;
    if (
      classification?.action === "set" &&
      classification.reuseFrom &&
      rejected.has(classification.reuseFrom.editionKey)
    ) {
      delete accepted.plan[slot]!.fields.classification;
    }
    const reused = accepted.location.reusedFrom?.[slot];
    if (!reused?.editionKey || !rejected.has(reused.editionKey)) {
      continue;
    }
    const fields = accepted.location.slots[slot];
    if (fields) {
      accepted.location.slots[slot] = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          {
            action: "keep",
            reason: "Editor rejected the earlier Edition premise",
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
  raw: unknown,
): StageResult<AcceptedProposals> {
  const parsed = reviewSchema(prepared).safeParse(raw);
  if (!parsed.success) {
    return reject(prepared, "Invalid review decision keys or values");
  }
  const review = parsed.data as {
    item: { decision: string; reason: string };
    event: { target: { decision: string; reason: string }; fields: unknown };
    previousEdition: {
      target: { decision: string };
      fields: Record<string, unknown>;
    } | null;
    currentOrNextEdition: {
      target: { decision: string };
      fields: Record<string, unknown>;
    } | null;
    unresolved: { message: string }[];
  };
  if (
    review.item.decision === "reject" ||
    review.event.target.decision === "reject"
  ) {
    return reject(
      {
        ...prepared,
        unresolved: [...prepared.unresolved, ...review.unresolved],
      },
      review.item.decision === "reject"
        ? review.item.reason
        : review.event.target.reason,
      "editor_rejected",
    );
  }
  const accepted = structuredClone(prepared) as AcceptedProposals;
  delete (accepted as Partial<PreparedProposals>).basis;
  const filter = (
    values: Record<string, unknown>,
    decisions: Record<string, unknown>,
  ) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        continue;
      }
      const decision = decisions[key] as Record<string, unknown>;
      if (decision.decision === "reject") {
        delete values[key];
      } else if (!("decision" in decision)) {
        filter(value as Record<string, unknown>, decision);
      }
    }
  };
  filter(
    accepted.plan.event!.fields,
    review.event.fields as Record<string, unknown>,
  );
  for (const slot of editionSlotNames) {
    const decisions = review[slot];
    if (!decisions) {
      continue;
    }
    const temporalRejected =
      decisions.target.decision === "reject" ||
      ["dates", "year", "scheduleStatus"].some(
        (field) =>
          (decisions.fields[field] as { decision?: string } | undefined)
            ?.decision === "reject",
      );
    if (temporalRejected) {
      accepted.plan[slot] = null;
      delete accepted.location.slots[slot];
      continue;
    }
    if (
      (decisions.fields.location as { decision?: string } | undefined)
        ?.decision === "reject"
    ) {
      const old = accepted.location.slots[slot]!;
      accepted.location.slots[slot] = Object.fromEntries(
        Object.keys(old).map((key) => [
          key,
          { action: "keep", reason: "Editor rejected proposed place changes" },
        ]),
      ) as typeof old;
    }
    filter(accepted.plan[slot]!.fields, decisions.fields);
  }
  discardRejectedDependencies(prepared, accepted, review);
  accepted.unresolved.push(...review.unresolved);
  return { status: "continue", value: accepted };
}
