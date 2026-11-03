import type { MaterializedLocation } from "./location/validate";
import type { ApplicationPlan, AcceptedProposals } from "./proposals";
import { isEditionPublishable } from "@/catalog/domain/validation";
import { createHash, randomUUID } from "node:crypto";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type {
  CatalogOperation,
  CatalogOperationMeta,
  CatalogPrice,
} from "@/catalog/operations/operation";
import type { ResearchCatalog } from "./research/context";
import type { CatalogResearchInput } from "./contracts";
import { editionSlotNames } from "./research/contracts";
import type { z } from "zod";
import type { ticketBlockSchema } from "./roles/contracts";
import {
  diagnosticsOnly,
  type PlanDiagnostics,
  type StageResult,
} from "./stage";
import { majorToMinor } from "./research/money";
type CombinedEditionPlan = NonNullable<
  ApplicationPlan["currentOrNextEdition"]
> & {
  fields: Partial<
    NonNullable<MaterializedLocation["slots"]["currentOrNextEdition"]>
  >;
};
type CombinedPlan = Omit<ApplicationPlan, (typeof editionSlotNames)[number]> &
  Record<(typeof editionSlotNames)[number], CombinedEditionPlan | null>;
type Event = ResearchCatalog[number];
type DraftOperation = CatalogOperation extends infer Op
  ? Op extends CatalogOperation
    ? Omit<Op, keyof CatalogOperationMeta | "expectedVersion">
    : never
  : never;
type Term = {
  id: string;
  facet: string;
  slug: string;
  parentId?: string | null;
};
type Reasons = Record<string, string[]>;
type EditionPatch = Extract<
  CatalogOperation,
  { kind: "updateEdition" }
>["data"];
type AddOperation = (
  draft: DraftOperation,
  reasons?: Reasons,
  expectedVersion?: number,
  tempKey?: string,
) => void;
export type ReadyCatalogPlan = AcceptedProposals & {
  operations: CatalogOperation[];
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
function mayPublish(
  record: Pick<Event, "publicationState"> | undefined,
  republish: boolean | undefined,
): boolean {
  return (
    !record ||
    record.publicationState === "draft" ||
    (record.publicationState === "withdrawn" && !!republish)
  );
}
function fieldName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function adder(
  result: ReadyCatalogPlan,
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
  value: z.infer<typeof ticketBlockSchema>["basePrice"],
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
type FieldAction<T> =
  | { action: "set"; value: T; reason: string }
  | { action: "clear" | "keep"; reason: string };
function valueOf<T>(action: FieldAction<T> | undefined): T | null | undefined {
  if (action?.action === "set") {
    return action.value;
  }
  if (action?.action === "clear") {
    return null;
  }
  return undefined;
}
function planInvalid(
  result: PlanDiagnostics,
  field: string,
  message: string,
): StageResult<never> {
  result.validationIssues = [
    { code: "invalid_plan", field, stage: "validation" },
  ];
  result.errors.push({
    code: "invalid_plan",
    stage: "validation",
    field,
    message,
  });
  return { status: "reject", diagnostics: diagnosticsOnly(result) };
}
function linksToOperations(
  add: AddOperation,
  owner: { type: "event" | "edition"; id: string },
  previous: Event["links"],
  version: number,
  slots: Record<string, FieldAction<string> | undefined>,
) {
  const changed = Object.entries(slots).filter(
    ([, action]) => action && action.action !== "keep",
  );
  if (!changed.length) {
    return;
  }
  const replaced = new Set(changed.map(([kind]) => kind));
  const links = previous
    .filter((link) => !replaced.has(link.kind))
    .map(({ kind, url, label, official }) => ({ kind, url, label, official }));
  for (const [kind, action] of changed) {
    if (action?.action !== "set") {
      continue;
    }
    const url = normalizeCatalogUrl(action.value);
    const saved = previous.find(
      (link) => link.kind === kind && normalizeCatalogUrl(link.url) === url,
    );
    links.push({
      kind: kind as Event["links"][number]["kind"],
      url,
      label: saved?.label ?? null,
      official: true,
    });
  }
  add(
    { kind: "replaceLinks", owner, links },
    { links: changed.map(([, action]) => action!.reason) },
    version,
  );
}
function fieldsToValues(fields: CombinedEditionPlan["fields"]) {
  const values: EditionPatch = {};
  const reasons: Reasons = {};
  const set = <K extends keyof EditionPatch>(
    field: K,
    value: EditionPatch[K],
    action: { reason: string },
  ) => {
    values[field] = value;
    reasons[fieldName(field)] = [action.reason];
  };
  if (fields.year?.action === "set") {
    set("editionYear", fields.year.value, fields.year);
  }
  const dates = valueOf(fields.dates);
  if (dates !== undefined) {
    set("startsOn", dates?.startsOn ?? null, fields.dates!);
    set("endsOn", dates?.endsOn ?? null, fields.dates!);
    set("dateState", dates?.state ?? "unknown", fields.dates!);
  }
  const coords = valueOf(fields.coordinates);
  if (coords !== undefined) {
    set("latitude", coords?.latitude ?? null, fields.coordinates!);
    set("longitude", coords?.longitude ?? null, fields.coordinates!);
    set(
      "coordinatePrecision",
      coords?.precision ?? "unknown",
      fields.coordinates!,
    );
  }
  if (fields.scheduleStatus?.action === "set") {
    set("scheduleStatus", fields.scheduleStatus.value, fields.scheduleStatus);
  }
  const size = valueOf(fields.sizeEstimate);
  if (size !== undefined) {
    set("sizeEstimate", size, fields.sizeEstimate!);
  }
  for (const field of [
    "displayName",
    "venueName",
    "venueAddress",
    "locality",
    "administrativeArea",
    "countryCode",
  ] as const) {
    const action = fields[field];
    const value = valueOf(action);
    if (value !== undefined) {
      set(field, value, action!);
    }
  }
  return { values, reasons };
}
/** Prepare one combined plan after both agents have completed validation. */
export function prepareCatalogPlan(
  validated: AcceptedProposals,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: Term[],
  location: MaterializedLocation,
): StageResult<ReadyCatalogPlan> {
  const result: ReadyCatalogPlan = {
    ...structuredClone(validated),
    operations: [],
    explanations: {},
  };
  const plan: CombinedPlan = structuredClone(result.plan);
  for (const slot of editionSlotNames) {
    if (!!plan[slot] !== !!location.slots[slot]) {
      return planInvalid(result, slot, "Location target mismatch");
    }
    if (plan[slot]) {
      plan[slot].fields = { ...plan[slot].fields, ...location.slots[slot] };
    }
  }
  result.unresolved.push(...location.unresolved);
  const event = catalog.find((item) => item.id === result.matchedEventId);
  const add = adder(result, input);

  const eventRef = event?.id ?? "$event";
  prepareEvent(plan.event!, event, result.eventName, add);
  let willPublishEdition = false;
  for (const [index, slot] of editionSlotNames.entries()) {
    const edition = plan[slot];
    if (
      edition &&
      prepareEdition(edition, index, event, eventRef, input, terms, add)
    ) {
      willPublishEdition = true;
    }
  }
  if (
    mayPublish(event, input.republish) &&
    (willPublishEdition ||
      event?.editions.some(
        (edition) => edition.publicationState === "published",
      ))
  ) {
    add({ kind: "publishEvent", id: eventRef }, {}, event?.version ?? 1);
  }
  return { status: "continue", value: result };
}

function prepareEvent(
  plan: NonNullable<ApplicationPlan["event"]>,
  event: Event | undefined,
  canonicalName: string,
  add: AddOperation,
) {
  const eventRef = event?.id ?? "$event";
  const summary = valueOf(plan.fields.summary);
  if (!event) {
    add(
      {
        kind: "createEvent",
        data: {
          slug: slug(canonicalName),
          canonicalName,
          ...(summary === undefined ? {} : { summary }),
        },
      },
      {
        canonical_name: [plan.reason!],
        ...(summary === undefined
          ? {}
          : { summary: [plan.fields.summary!.reason] }),
      },
      undefined,
      "event",
    );
  } else if (summary !== undefined) {
    add(
      { kind: "updateEvent", id: eventRef, data: { summary } },
      { summary: [plan.fields.summary!.reason] },
      event.version,
    );
  }
  linksToOperations(
    add,
    { type: "event", id: eventRef },
    event?.links ?? [],
    event?.version ?? 1,
    {
      official_site: plan.fields.links?.website,
      ...plan.fields.links?.socials,
    },
  );
}

function prepareEdition(
  edition: CombinedEditionPlan,
  index: number,
  event: Event | undefined,
  eventRef: string,
  input: CatalogResearchInput,
  terms: Term[],
  add: AddOperation,
): boolean {
  const key = edition.editionKey;
  const saved = event?.editions.find((item) => item.editionKey === key);
  const id = saved?.id ?? `$edition_${index}`;
  const version = saved?.version ?? 1;
  const { values, reasons } = fieldsToValues(edition.fields);
  if (!saved) {
    add(
      {
        kind: "createEdition",
        eventId: eventRef,
        data: { editionKey: key, ...values },
      },
      {
        ...reasons,
        edition_key: [edition.reason!],
      },
      undefined,
      id.slice(1),
    );
  } else if (Object.keys(values).length) {
    add({ kind: "updateEdition", id, data: values }, reasons, version);
  }
  const assigned = valueOf(edition.fields.classification);
  const nextTerms =
    assigned === undefined
      ? (saved?.terms.map((term) => term.id) ?? [])
      : (assigned ?? []);
  if (assigned !== undefined) {
    add(
      { kind: "replaceTerms", id, termIds: nextTerms },
      { terms: [edition.fields.classification!.reason] },
      version,
    );
  }
  const tickets = valueOf(edition.fields.tickets);
  if (tickets !== undefined) {
    const ticketReason = [edition.fields.tickets!.reason];
    add(
      {
        kind: "replacePriceBlock",
        id,
        priceDetails: tickets?.variants ?? [],
        basePrice: tickets ? catalogBasePrice(tickets.basePrice) : null,
      },
      Object.fromEntries(
        [
          "price_details",
          "price_kind",
          "price_currency",
          "price_min_minor",
          "price_max_minor",
          "price_coverage",
          "price_qualification",
        ].map((field) => [field, ticketReason]),
      ),
      version,
    );
  }
  linksToOperations(add, { type: "edition", id }, saved?.links ?? [], version, {
    ticketing: edition.fields.links?.tickets,
  });
  if (
    mayPublish(saved, input.republish) &&
    isEditionPublishable(
      { ...saved, ...values },
      terms.filter((term) => nextTerms.includes(term.id)),
    )
  ) {
    add({ kind: "publishEdition", id }, {}, version);
    return true;
  }
  return false;
}
