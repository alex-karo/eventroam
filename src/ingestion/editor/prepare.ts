import {
  editorPlanSchema,
  eventFieldsSchema,
  editionFieldsSchema,
  type ResolvedEditorPlan as EditorPlan,
  type EditorPlan as RawEditorPlan,
} from "./contracts";
import type { z } from "zod";
import { normalizeEditorWire } from "./wire";
import { isEditionPublishable } from "@/catalog/domain/validation";
import { createHash, randomUUID } from "node:crypto";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import type {
  CatalogOperation,
  CatalogOperationMeta,
  CatalogPrice,
} from "@/catalog/operations/operation";
import type { ResearchCatalog } from "../research/context";
import type { CatalogResearchInput } from "../contracts";
import {
  researchCandidateSchema,
  type ResearchCandidate,
  type ResearchData,
  type ResearchError,
  type ResearchQuestion,
} from "../research/contracts";
import { validateRefresh } from "../research/guards";
import { majorToMinor } from "../research/money";

type EditionPlan = EditorPlan["editions"][number];
type Event = ResearchCatalog[number];
type Edition = ResearchData["editions"][number];
type DraftOperation = CatalogOperation extends infer Op
  ? Op extends CatalogOperation
    ? Omit<Op, keyof CatalogOperationMeta | "expectedVersion">
    : never
  : never;
type Term = { id: string; facet: string; slug: string };
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
export type EventNameMismatch = {
  eventId: string;
  storedName: string;
  observedName: string;
};
export type PreparedPlan = {
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
function invalid(result: PreparedPlan, message: string): PreparedPlan {
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
  result: PreparedPlan,
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
/** Validate research and assignment before editing. Never creates mutations. */
export function validateResearch(
  raw: unknown,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
): PreparedPlan {
  const result: PreparedPlan = {
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
  if (input.mode === "refresh") {
    const error = validateRefresh(candidate, event!.editions, input.scope);
    if (error) {
      result.candidate = null;
      result.errors.push(error);
      return result;
    }
  }
  return result;
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
function planInvalid(result: PreparedPlan, field: string, message: string) {
  result.operations = [];
  result.explanations = {};
  result.validationIssues = [
    { code: "invalid_plan", field, stage: "validation" },
  ];
  result.errors.push({
    code: "invalid_plan",
    stage: "validation",
    field,
    message,
  });
  return result;
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
function fieldsToValues(fields: EditionPlan["fields"]) {
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
function hasClear(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    ("action" in value
      ? value.action === "clear"
      : Object.values(value).some(hasClear))
  );
}

/** Explicit domain conversions from the editor's plan to existing operations. */
export function prepareEditorPlan(
  raw: unknown,
  validated: PreparedPlan,
  catalog: ResearchCatalog,
  input: CatalogResearchInput,
  terms: Term[],
): PreparedPlan {
  const result = structuredClone(validated);
  if (
    !result.candidate ||
    result.candidate.status === "failed" ||
    result.skipped
  ) {
    return result;
  }
  const parsed = editorPlanSchema.safeParse(normalizeEditorWire(raw));
  if (!parsed.success) {
    return planInvalid(
      result,
      parsed.error.issues[0]?.path.join(".") ?? "$",
      "Invalid editorial plan structure",
    );
  }
  if (parsed.data.status === "rejected") {
    result.operations = [];
    result.errors.push({
      code: "editor_rejected",
      stage: "editor",
      message: parsed.data.reason,
    });
    return result;
  }
  const resolved = resolveEditorFields(parsed.data, result.candidate.data!);
  if (!resolved.ok) {
    return planInvalid(result, resolved.issue.field, resolved.issue.message);
  }
  const plan = resolved.plan;
  result.unresolved.push(...plan.unresolved);
  if (!plan.event) {
    if (input.mode !== "add") {
      return planInvalid(
        result,
        "event",
        "Refresh requires an existing Event target",
      );
    }
    result.skipped = true;
    return result;
  }
  const event = catalog.find((item) => item.id === result.matchedEventId);
  if (!event && !plan.event.reason) {
    return planInvalid(
      result,
      "event.reason",
      "New Event requires a creation reason",
    );
  }
  if (!event && hasClear(plan.event.fields)) {
    return planInvalid(
      result,
      "event.fields",
      "Cannot clear values on a new Event",
    );
  }
  const issue = validateEditionTargets(
    plan.editions,
    event,
    result,
    input,
    terms,
  );
  if (issue) {
    return planInvalid(result, issue.field, issue.message);
  }
  const add = adder(result, input);
  const eventRef = event?.id ?? "$event";
  prepareEvent(plan.event, event, result.candidate.data!.eventName, add);
  let willPublishEdition = false;
  for (const [index, edition] of plan.editions.entries()) {
    if (prepareEdition(edition, index, event, eventRef, input, terms, add)) {
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
  return result;
}

type AcceptAction = { action: "accept" };
type KeepAction = { action: "keep"; reason: string };
type SetAction<T> = { action: "set"; value: T; reason: string };

class FieldIssue extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

// Action contracts put the set branch first; reuse its value validation for accept.
type ActionValueSchema<T> = {
  unwrap(): {
    options: readonly [{ shape: { value: z.ZodType<T> } }, ...unknown[]];
  };
};

function resolveAction<T>(
  action: SetAction<T> | KeepAction | AcceptAction | undefined,
  finding: unknown,
  schema: ActionValueSchema<T>,
  path: string,
): SetAction<T> | KeepAction | undefined;
function resolveAction<T>(
  action: FieldAction<T> | AcceptAction | undefined,
  finding: unknown,
  schema: ActionValueSchema<T>,
  path: string,
): FieldAction<T> | undefined;
function resolveAction<T>(
  action: FieldAction<T> | AcceptAction | undefined,
  finding: unknown,
  schema: ActionValueSchema<T>,
  path: string,
): FieldAction<T> | undefined {
  if (!action || action.action === "keep") {
    return action;
  }
  if (finding === undefined) {
    throw new FieldIssue(
      path,
      "Editorial mutation requires a structured finding for the same field and Edition",
    );
  }
  if (action.action !== "accept") {
    return action;
  }
  const wrapped =
    finding && typeof finding === "object" && "value" in finding
      ? finding
      : {
          value: finding,
          reason: "Accepted officially associated research link",
        };
  const value = schema.unwrap().options[0].shape.value.safeParse(wrapped.value);
  if (
    wrapped.value == null ||
    !value.success ||
    !("reason" in wrapped) ||
    typeof wrapped.reason !== "string"
  ) {
    throw new FieldIssue(
      path,
      "Accept requires a non-null same-field research value valid for the editor contract",
    );
  }
  return { action: "set", value: value.data, reason: wrapped.reason };
}

type FieldValue<Action> = Action extends SetAction<infer Value> ? Value : never;

/** Bind each action to the same named finding, schema and error path. */
function fieldResolver<
  Fields extends Record<
    string,
    FieldAction<unknown> | AcceptAction | undefined
  >,
>(
  fields: Fields,
  findings: Partial<Record<keyof Fields, unknown>> | undefined,
  schemas: { [K in keyof Fields]: ActionValueSchema<FieldValue<Fields[K]>> },
  path: string,
) {
  return <K extends keyof Fields & string>(key: K) =>
    // resolveAction preserves concrete actions and validates accepted values.
    resolveAction(
      fields[key],
      findings?.[key],
      schemas[key],
      `${path}.${key}`,
    ) as Exclude<Fields[K], AcceptAction>;
}

/** Resolve and check support together; only concrete typed actions reach conversion. */
function resolveEditorFields(
  plan: RawEditorPlan,
  data: ResearchData,
): { ok: true; plan: EditorPlan } | { ok: false; issue: FieldIssue } {
  try {
    const eventSchema = eventFieldsSchema.shape;
    const linkSchema = eventSchema.links.unwrap().shape;
    const eventLinks = plan.event?.fields.links;
    const socialActions = eventLinks?.socials;
    const resolveSocial = socialActions
      ? fieldResolver(
          socialActions,
          data.links.socials,
          linkSchema.socials.unwrap().shape,
          "event.fields.links.socials",
        )
      : undefined;
    return {
      ok: true,
      plan: {
        ...plan,
        event: plan.event
          ? {
              ...plan.event,
              fields: {
                summary: resolveAction(
                  plan.event.fields.summary,
                  data.summary,
                  eventSchema.summary,
                  "event.fields.summary",
                ),
                links: eventLinks
                  ? {
                      website: resolveAction(
                        eventLinks.website,
                        data.links.website,
                        linkSchema.website,
                        "event.fields.links.website",
                      ),
                      socials: resolveSocial
                        ? {
                            instagram: resolveSocial("instagram"),
                            facebook: resolveSocial("facebook"),
                            youtube: resolveSocial("youtube"),
                            tiktok: resolveSocial("tiktok"),
                            x: resolveSocial("x"),
                            other: resolveSocial("other"),
                          }
                        : undefined,
                    }
                  : undefined,
              },
            }
          : null,
        editions: plan.editions.map((edition, index) => {
          const finding = data.editions.find(
            (item) => item.key === edition.editionKey,
          );
          const { links, ...fields } = edition.fields;
          const path = `editions.${index}.fields`;
          const resolve = fieldResolver(
            fields,
            finding,
            editionFieldsSchema.shape,
            path,
          );
          return {
            ...edition,
            fields: {
              year: resolve("year"),
              dates: resolve("dates"),
              coordinates: resolve("coordinates"),
              scheduleStatus: resolve("scheduleStatus"),
              displayName: resolve("displayName"),
              venueName: resolve("venueName"),
              venueAddress: resolve("venueAddress"),
              locality: resolve("locality"),
              administrativeArea: resolve("administrativeArea"),
              countryCode: resolve("countryCode"),
              sizeEstimate: resolve("sizeEstimate"),
              tickets: resolve("tickets"),
              classification: resolve("classification"),
              links: links
                ? {
                    tickets: resolveAction(
                      links.tickets,
                      finding?.links.tickets,
                      editionFieldsSchema.shape.links.unwrap().shape.tickets,
                      `${path}.links.tickets`,
                    ),
                  }
                : undefined,
            },
          };
        }),
      },
    };
  } catch (error) {
    if (error instanceof FieldIssue) {
      return { ok: false, issue: error };
    }
    throw error;
  }
}

function validateEditionTargets(
  editions: EditionPlan[],
  event: Event | undefined,
  result: PreparedPlan,
  input: CatalogResearchInput,
  terms: Term[],
) {
  const savedKeys = new Set(
    event?.editions.map((edition) => edition.editionKey),
  );
  const newTargets = editions.filter(
    (edition) => !savedKeys.has(edition.editionKey),
  );
  if (
    input.mode === "refresh" &&
    ((input.scope === "current" && editions.length > 1) ||
      newTargets.length > 1 ||
      ((input.scope ?? "full") === "full" &&
        savedKeys.size + newTargets.length > 20))
  ) {
    return {
      field: "editions",
      message: "Editorial plan exceeds refresh scope bounds",
    };
  }
  const baseline = event?.editions.find(
    (edition) => edition.countryCode,
  )?.countryCode;
  for (const edition of editions) {
    const key = edition.editionKey;
    const creating = !savedKeys.has(key);
    if (
      creating &&
      !result.candidate!.data!.editions.some((finding) => finding.key === key)
    ) {
      return {
        field: "editions.editionKey",
        message: "New Edition key is outside research assignment",
      };
    }
    if (creating && !edition.reason) {
      return {
        field: "editions.reason",
        message: "New Edition requires a creation reason",
      };
    }
    if (creating && hasClear(edition.fields)) {
      return {
        field: "editions.fields",
        message: "Cannot clear values on a new Edition",
      };
    }
    const country = valueOf(edition.fields.countryCode);
    if (baseline && country !== undefined && country !== baseline) {
      return {
        field: "countryCode",
        message: "Editorial country conflicts with saved country",
      };
    }
    const ids = valueOf(edition.fields.classification);
    if (ids?.some((id) => !terms.some((term) => term.id === id))) {
      return {
        field: "classification",
        message: "Unknown classification term",
      };
    }
  }
  return null;
}

function prepareEvent(
  plan: NonNullable<EditorPlan["event"]>,
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
  edition: EditionPlan,
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
