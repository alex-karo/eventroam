import { createHash, randomUUID } from "node:crypto";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type {
  CatalogOperation,
  CatalogOperationMeta,
  CatalogPrice,
} from "@/catalog/operations/operation";
import type { readResearchCatalog } from "@/catalog/read/research";
import type { CatalogResearchInput } from "../contracts";
import {
  researchCandidateSchema,
  type ResearchCandidate,
  type ResearchData,
  type ResearchError,
  type ResearchQuestion,
} from "./contracts";
import { majorToMinor } from "./money";

export type ResearchCatalog = ReturnType<typeof readResearchCatalog>;
type Event = ResearchCatalog[number];
type Edition = ResearchData["editions"][number];
type DraftOperation = CatalogOperation extends infer Op
  ? Op extends CatalogOperation
    ? Omit<Op, keyof CatalogOperationMeta | "expectedVersion">
    : never
  : never;
type Term = { id: string; facet: string; slug: string };
type Reasons = Record<string, string[]>;
type AddOperation = (
  draft: DraftOperation,
  reasons?: Reasons,
  expectedVersion?: number,
  tempKey?: string,
) => void;
export type EventNameMismatch = {
  eventId: string;
  storedName: string;
  observedName: string;
};
export type PreparedResearch = {
  validation: {
    structural: "passed" | "failed";
    target: "passed" | "failed" | "not_run";
  };
  candidate: ResearchCandidate | null;
  operations: CatalogOperation[];
  errors: ResearchError[];
  validationIssues?: { code: string; field: string; stage: "validation" }[];
  unresolved: ResearchQuestion[];
  matchedEventId?: string;
  skipped: boolean;
  eventNameMismatch: EventNameMismatch | null;
  explanations: Record<string, Reasons>;
};

function slug(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, 100)
    .replace(/-$/, "");
  return (
    ascii ||
    `event-${createHash("sha256").update(value.normalize("NFKC")).digest("hex").slice(0, 12)}`
  );
}
function fieldName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function invalid(result: PreparedResearch, message: string): PreparedResearch {
  result.candidate = null;
  result.operations = [];
  result.explanations = {};
  result.errors.push({
    code: "invalid_candidate",
    stage: "validation",
    message,
  });
  return result;
}
function adder(
  result: PreparedResearch,
  input: CatalogResearchInput,
): AddOperation {
  return (draft, reasons = {}, expectedVersion, tempKey) => {
    const operationKey = randomUUID();
    result.operations.push({
      ...draft,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      ...(tempKey ? { tempKey } : {}),
      operationKey,
      actor: input.actor,
      ...(input.initiatedBy ? { initiatedBy: input.initiatedBy } : {}),
    } as CatalogOperation);
    if (Object.keys(reasons).length) {
      result.explanations[operationKey] = reasons;
    }
  };
}
function catalogBasePrice(
  value: NonNullable<Edition["tickets"]>["value"]["basePrice"],
): CatalogPrice | null {
  if (!value) {
    return null;
  }
  if (value.kind === "free") {
    return {
      kind: "free",
      minMinor: 0,
      maxMinor: 0,
      coverage: "full_programme",
      ...(value.qualification ? { qualification: value.qualification } : {}),
    };
  }
  return {
    kind: value.kind,
    currency: value.currency,
    minMinor: majorToMinor(value.minAmount, value.currency),
    maxMinor: majorToMinor(value.maxAmount, value.currency),
    coverage: "full_programme",
    ...(value.qualification ? { qualification: value.qualification } : {}),
  };
}
function addLinks(
  add: AddOperation,
  owner: { type: "event" | "occurrence"; id: string },
  previous: Event["links"],
  version: number,
  slots: Record<string, string | undefined>,
) {
  const supplied = Object.entries(slots).filter(([, url]) => !!url);
  if (!supplied.length) {
    return;
  }
  const replacements = new Map(
    supplied.map(([kind, url]) => [kind, normalizeCatalogUrl(url!)]),
  );
  const unchanged = supplied.every(([kind, url]) => {
    const old = previous.filter((link) => link.kind === kind);
    return (
      old.length === 1 &&
      normalizeCatalogUrl(old[0].url) === normalizeCatalogUrl(url!)
    );
  });
  if (unchanged) {
    return;
  }
  const kept = previous
    .filter((link) => !replacements.has(link.kind))
    .map((link) => ({
      kind: link.kind,
      url: normalizeCatalogUrl(link.url),
      label: link.label,
      official: link.official,
    }));
  const selected = [...replacements].map(([kind, url]) => {
    const saved = previous.find(
      (link) => link.kind === kind && normalizeCatalogUrl(link.url) === url,
    );
    return {
      kind: kind as Event["links"][number]["kind"],
      url,
      label: saved?.label ?? null,
      official: true,
    };
  });
  add(
    { kind: "replaceLinks", owner, links: [...kept, ...selected] },
    {},
    version,
  );
}
function editionFields(edition: Edition): {
  fields: Record<string, unknown>;
  reasons: Reasons;
} {
  const fields: Record<string, unknown> = {};
  const reasons: Reasons = {};
  const set = (field: string, value: unknown, reason: string) => {
    fields[field] = value;
    reasons[fieldName(field)] = [reason];
  };
  if (edition.year) {
    set("occurrenceYear", edition.year.value, edition.year.reason);
  }
  if (edition.dates) {
    set(
      "startsOn",
      edition.dates.value?.startsOn ?? null,
      edition.dates.reason,
    );
    set("endsOn", edition.dates.value?.endsOn ?? null, edition.dates.reason);
    set(
      "dateState",
      edition.dates.value?.state ?? "unknown",
      edition.dates.reason,
    );
  }
  if (edition.coordinates) {
    set(
      "latitude",
      edition.coordinates.value?.latitude ?? null,
      edition.coordinates.reason,
    );
    set(
      "longitude",
      edition.coordinates.value?.longitude ?? null,
      edition.coordinates.reason,
    );
    set(
      "coordinatePrecision",
      edition.coordinates.value?.precision ?? "unknown",
      edition.coordinates.reason,
    );
  }
  for (const field of [
    "scheduleStatus",
    "displayName",
    "venueName",
    "venueAddress",
    "locality",
    "administrativeArea",
    "countryCode",
    "capacityEstimate",
  ] as const) {
    const fact = edition[field];
    if (fact) {
      set(field, fact.value, fact.reason);
    }
  }
  return { fields, reasons };
}
function prepareTerms(
  add: AddOperation,
  edition: Edition,
  existing: Event["editions"][number] | undefined,
  id: string,
  version: number,
) {
  const additions = edition.classification?.add?.value ?? [];
  const removals = edition.classification?.remove?.value ?? [];
  const old = existing?.terms.map((term) => term.id) ?? [];
  const next = [...new Set([...old, ...additions])].filter(
    (term) => !removals.includes(term),
  );
  if (additions.length || removals.length) {
    const reasons = [
      edition.classification?.add?.reason,
      edition.classification?.remove?.reason,
    ].filter((reason): reason is string => !!reason);
    add(
      { kind: "replaceTerms", id, termIds: next },
      { terms: [...new Set(reasons)] },
      version,
    );
  }
  return next;
}
function prepareTickets(
  add: AddOperation,
  edition: Edition,
  id: string,
  version: number,
) {
  if (!edition.tickets) {
    return;
  }
  const reason = [edition.tickets.reason];
  add(
    {
      kind: "replacePriceBlock",
      id,
      priceDetails: edition.tickets.value.variants,
      basePrice: catalogBasePrice(edition.tickets.value.basePrice),
    },
    {
      price_details: reason,
      price_kind: reason,
      price_currency: reason,
      price_min_minor: reason,
      price_max_minor: reason,
      price_coverage: reason,
      price_qualification: reason,
    },
    version,
  );
}
function isPublishable(
  state: Record<string, unknown>,
  nextTerms: string[],
  terms: Term[],
): boolean {
  const hasScope = (facet: string, allowed: string[]) =>
    nextTerms.some((id) => {
      const term = terms.find((item) => item.id === id);
      return term?.facet === facet && allowed.includes(term.slug);
    });
  return (
    state.occurrenceYear != null &&
    state.startsOn != null &&
    state.endsOn != null &&
    state.countryCode != null &&
    (state.venueName != null ||
      state.locality != null ||
      state.administrativeArea != null) &&
    hasScope("format", ["outdoor", "mixed-indoor-outdoor"]) &&
    hasScope("event_type", ["festival", "gathering"]) &&
    (hasScope("topic", ["music"]) || hasScope("culture", ["burning-like"]))
  );
}
function prepareEdition(
  add: AddOperation,
  edition: Edition,
  index: number,
  event: Event | undefined,
  eventRef: string,
  input: CatalogResearchInput,
  terms: Term[],
): boolean {
  const existing = event?.editions.find(
    (item) => item.occurrenceKey === edition.key,
  );
  const id = existing?.id ?? `$occ_${index}`;
  const version = existing?.version ?? 1;
  const { fields, reasons } = editionFields(edition);
  if (!existing) {
    add(
      {
        kind: "createOccurrence",
        eventId: eventRef,
        data: { occurrenceKey: edition.key, ...fields },
      },
      reasons,
      undefined,
      id.slice(1),
    );
  } else if (Object.keys(fields).length) {
    add({ kind: "updateOccurrence", id, data: fields }, reasons, version);
  }
  const nextTerms = prepareTerms(add, edition, existing, id, version);
  prepareTickets(add, edition, id, version);
  addLinks(add, { type: "occurrence", id }, existing?.links ?? [], version, {
    ticketing: edition.links.tickets,
  });
  const mayPublish =
    !existing ||
    existing.publicationState === "draft" ||
    (existing.publicationState === "withdrawn" && input.republish);
  if (
    mayPublish &&
    isPublishable({ ...existing, ...fields }, nextTerms, terms)
  ) {
    add({ kind: "publishOccurrence", id }, {}, version);
    return true;
  }
  return false;
}
function addEvent(
  add: AddOperation,
  data: ResearchData,
  event: Event | undefined,
) {
  if (!event) {
    add(
      {
        kind: "createEvent",
        data: {
          slug: slug(data.eventName),
          canonicalName: data.eventName,
          ...(data.summary ? { summary: data.summary.value } : {}),
        },
      },
      {
        canonical_name: [data.reason!],
        ...(data.summary ? { summary: [data.summary.reason] } : {}),
      },
      undefined,
      "event",
    );
  } else if (data.summary && data.summary.value !== event.summary) {
    add(
      {
        kind: "updateEvent",
        id: event.id,
        data: { summary: data.summary.value },
      },
      { summary: [data.summary.reason] },
      event.version,
    );
  }
}

/** Structural adaptation only; factual interpretation belongs to the model. */
export function prepareResearch(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: Term[],
): PreparedResearch {
  const result: PreparedResearch = {
    validation: { structural: "failed", target: "not_run" },
    candidate: null,
    operations: [],
    errors: [],
    unresolved: [],
    skipped: false,
    eventNameMismatch: null,
    explanations: {},
  };
  const parsed = researchCandidateSchema.safeParse(raw);
  if (!parsed.success) {
    result.validationIssues = parsed.error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.join(".") || "$",
      stage: "validation",
    }));
    return invalid(
      result,
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}:${issue.code}`)
        .join(", "),
    );
  }
  result.validation.structural = "passed";
  const candidate = parsed.data;
  result.candidate = candidate;
  result.errors = candidate.errors.map((error) => ({
    ...error,
    stage: error.code === "limit_reached" ? "research" : "source",
  }));
  result.unresolved = candidate.unresolved;
  if (candidate.status === "failed") {
    return result;
  }
  const data = candidate.data!;
  const matchedEventId = data.eventId ?? input.eventId;
  const event = catalog.find((item) => item.id === matchedEventId);
  if (
    (matchedEventId && !event) ||
    (input.eventId && data.eventId && input.eventId !== data.eventId) ||
    (!event && input.mode !== "add")
  ) {
    result.validation.target = "failed";
    result.validationIssues = [
      { code: "invalid_target", field: "data.eventId", stage: "validation" },
    ];
    return invalid(result, "Event is outside the requested catalog target");
  }
  result.validation.target = "passed";
  result.matchedEventId = matchedEventId;
  if (!event && !data.reason) {
    result.validationIssues = [
      {
        code: "missing_creation_reason",
        field: "data.reason",
        stage: "validation",
      },
    ];
    return invalid(result, "data.reason is required for Event creation");
  }
  if (event && event.canonicalName.trim() !== data.eventName.trim()) {
    result.eventNameMismatch = {
      eventId: event.id,
      storedName: event.canonicalName,
      observedName: data.eventName,
    };
  }
  if (input.mode === "add" && event) {
    result.skipped = true;
    return result;
  }
  const add = adder(result, input);
  const eventRef = event?.id ?? "$event";
  addEvent(add, data, event);
  addLinks(
    add,
    { type: "event", id: eventRef },
    event?.links ?? [],
    event?.version ?? 1,
    { official_site: data.links.website, ...data.links.socials },
  );
  const willPublishOccurrence = data.editions
    .map((edition, index) =>
      prepareEdition(add, edition, index, event, eventRef, input, terms),
    )
    .some(Boolean);
  const eventMayPublish =
    !event ||
    event.publicationState === "draft" ||
    (event.publicationState === "withdrawn" && input.republish);
  if (
    eventMayPublish &&
    (willPublishOccurrence ||
      event?.editions.some((item) => item.publicationState === "published"))
  ) {
    add({ kind: "publishEvent", id: eventRef }, {}, event?.version ?? 1);
  }
  return result;
}
