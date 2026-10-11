import {
  validateEventRecord,
  validateEditionRecord,
  validateAliasRecord,
  validateTermAssignments,
} from "@/catalog/domain/validation";
import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  catalogChanges,
  events,
  externalLinks,
  editionTerms,
  editions,
  operationReceipts,
  taxonomyTerms,
  urlAliases,
  type CatalogFieldChange,
} from "@/db/schema";
import {
  catalogOperationSchema,
  type CatalogOperation,
  type CatalogOperationMeta,
  type CatalogOperationResult,
  type CatalogPrice,
  type CatalogPriceDetail,
} from "@/catalog/operations/operation";
import { isAssignedCountryCode } from "@/catalog/domain/country-codes";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";

type EventRow = typeof events.$inferSelect;
type EditionRow = typeof editions.$inferSelect;
type EventValues = typeof events.$inferInsert;
type EditionValues = typeof editions.$inferInsert;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
function eventRow(client: Database.Database, id: string): EventRow {
  const found = drizzle(client)
    .select()
    .from(events)
    .where(eq(events.id, id))
    .get();
  assert(found, "events record not found");
  return found;
}
function editionRow(client: Database.Database, id: string): EditionRow {
  const found = drizzle(client)
    .select()
    .from(editions)
    .where(eq(editions.id, id))
    .get();
  assert(found, "editions record not found");
  return found;
}
function normalizedPriceDetails(details: CatalogPriceDetail[]) {
  const normalized = details.map((detail) => ({
    label: detail.label,
    ...(detail.amount === undefined
      ? {}
      : { amount: detail.amount, currency: detail.currency }),
    ...(detail.terms === undefined ? {} : { terms: detail.terms }),
    ...(detail.availability === undefined
      ? {}
      : { availability: detail.availability }),
    ...(detail.url === undefined
      ? {}
      : { url: normalizeCatalogUrl(detail.url) }),
  }));
  return [
    ...new Map(
      normalized.map((detail) => [JSON.stringify(detail), detail]),
    ).values(),
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function withoutUndefined<T extends object>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}
function priceColumns(p: CatalogPrice | null) {
  return {
    priceKind: p?.kind ?? null,
    priceCurrency: p && "currency" in p ? p.currency : null,
    priceMinMinor: p?.minMinor ?? null,
    priceMaxMinor: p?.maxMinor ?? null,
    priceCoverage: p?.coverage ?? null,
    priceQualification: p?.qualification ?? null,
  };
}
function editionData<T extends object>(
  data: T,
): Omit<T, "price"> & Partial<EditionValues> {
  // Expanding at price's original position also preserves audit field order.
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }
    if (key === "price") {
      entries.push(
        ...Object.entries(priceColumns((value as CatalogPrice | null) ?? null)),
      );
    } else {
      entries.push([key, value]);
    }
  }
  return Object.fromEntries(entries) as Omit<T, "price"> &
    Partial<EditionValues>;
}
function validateEdition(r: Partial<EditionRow>) {
  validateEditionRecord(r);
  if (r.countryCode != null) {
    assert(
      typeof r.countryCode === "string" && isAssignedCountryCode(r.countryCode),
      "Country code is not assigned by ISO 3166-1",
    );
  }
  if (r.timeZone != null) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: r.timeZone });
    } catch {
      throw new Error("Invalid IANA time zone");
    }
  }
}
function setEvent(
  client: Database.Database,
  id: string,
  values: Partial<EventValues>,
) {
  validateEventRecord({ ...eventRow(client, id), ...values });
  const db = drizzle(client);
  db.update(events).set(values).where(eq(events.id, id)).run();
}
function setEdition(
  client: Database.Database,
  id: string,
  values: Partial<EditionValues>,
) {
  validateEdition({ ...editionRow(client, id), ...values });
  const db = drizzle(client);
  db.update(editions).set(values).where(eq(editions.id, id)).run();
}
function diff<T extends object>(
  table: typeof events | typeof editions,
  old: Partial<T>,
  next: Partial<T>,
): CatalogFieldChange[] {
  const names = getTableColumns(table) as Record<string, { name: string }>;
  return Object.entries(next)
    .filter(([key, value]) => {
      const previous = old[key as keyof T];
      return Array.isArray(value) && Array.isArray(previous)
        ? JSON.stringify(previous) !== JSON.stringify(value)
        : previous !== value;
    })
    .map(([key, newValue]) => {
      const column = names[key];
      assert(column, `Unknown audit column: ${key}`);
      return {
        field: column.name,
        oldPresent: Object.hasOwn(old, key),
        oldValue: old[key as keyof T] ?? null,
        newValue: newValue ?? null,
      };
    });
}
function validateScope(client: Database.Database, id: string) {
  const terms = drizzle(client)
    .select({ facet: taxonomyTerms.facet, slug: taxonomyTerms.slug })
    .from(editionTerms)
    .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, editionTerms.termId))
    .where(eq(editionTerms.editionId, id))
    .all();
  const has = (facet: string, slug: string) =>
    terms.some((t) => t.facet === facet && t.slug === slug);
  assert(
    has("format", "openair") || has("format", "mixed-indoor-outdoor"),
    "Festival scope requires supported open-air format",
  );
  assert(
    has("event_type", "festival") || has("event_type", "gathering"),
    "Festival scope requires event type",
  );
  assert(
    has("topic", "music") || has("culture", "burning-like"),
    "Festival scope requires music or burning-like culture",
  );
}
function writeChange(
  client: Database.Database,
  meta: CatalogOperationMeta,
  subject: "event" | "edition",
  id: string,
  version: number,
  changes: CatalogFieldChange[],
  now: string,
) {
  assert(changes.length > 0, "Catalog change needs at least one field");
  const changeId = randomUUID();
  const db = drizzle(client);
  db.insert(catalogChanges)
    .values({
      id: changeId,
      eventId: subject === "event" ? id : null,
      editionId: subject === "edition" ? id : null,
      subjectVersion: version,
      changedFields: changes,
      operationKey: meta.operationKey,
      actor: meta.actor,
      initiatedBy: meta.initiatedBy ?? null,
      changedAt: now,
      note: meta.note ?? null,
    })
    .run();
}
function alias(
  client: Database.Database,
  scope: string,
  path: string,
  eventId: string,
  editionId: string | null,
  now: string,
) {
  validateAliasRecord({ scope });
  const db = drizzle(client);
  const existing = db
    .select({
      eventId: urlAliases.eventId,
      editionId: urlAliases.editionId,
    })
    .from(urlAliases)
    .where(and(eq(urlAliases.scope, scope), eq(urlAliases.path, path)))
    .get();
  assert(
    !existing ||
      (existing.eventId === eventId && existing.editionId === editionId),
    "Public URL is reserved by another identity",
  );
  if (!existing) {
    db.insert(urlAliases)
      .values({ scope, path, eventId, editionId, createdAt: now })
      .run();
  }
}
function reserveEventPaths(
  client: Database.Database,
  event: EventRow,
  now: string,
) {
  const scope = event.homeScope as string;
  const eventId = event.id;
  alias(client, scope, `/events/${event.slug}`, eventId, null, now);
  const children = drizzle(client)
    .select({
      id: editions.id,
      editionKey: editions.editionKey,
      publicationState: editions.publicationState,
    })
    .from(editions)
    .where(eq(editions.eventId, eventId))
    .all();
  for (const child of children) {
    if (child.publicationState === "published") {
      alias(
        client,
        scope,
        `/events/${event.slug}/${child.editionKey}`,
        eventId,
        child.id,
        now,
      );
    }
  }
}
function reserveEditionPath(
  client: Database.Database,
  edition: EditionRow,
  now: string,
) {
  const event = eventRow(client, edition.eventId);
  if (event.homeScope) {
    alias(
      client,
      event.homeScope,
      `/events/${event.slug}/${edition.editionKey}`,
      event.id,
      edition.id,
      now,
    );
  }
}
function bumpEvent(
  client: Database.Database,
  id: string,
  version: number,
  values: Partial<EventValues>,
  now: string,
) {
  setEvent(client, id, { ...values, version: version + 1, updatedAt: now });
}
function bumpEdition(
  client: Database.Database,
  id: string,
  version: number,
  values: Partial<EditionValues>,
  now: string,
) {
  setEdition(client, id, {
    ...values,
    version: version + 1,
    updatedAt: now,
  });
}
function createEvent(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "createEvent" }>,
  now: string,
): CatalogOperationResult {
  const db = drizzle(client);
  const id = randomUUID();
  const data = withoutUndefined(op.data);
  assert(
    !db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, data.slug))
      .get(),
    `Event slug "${data.slug}" is already used by another Event`,
  );
  assert(
    !db
      .select({ path: urlAliases.path })
      .from(urlAliases)
      .where(eq(urlAliases.path, `/events/${data.slug}`))
      .get(),
    `Event slug "${data.slug}" has a public URL reserved by another identity`,
  );
  const record = {
    id,
    ...data,
    aliases: data.aliases ?? [],
    homeScope: null,
    publicationState: "draft" as const,
    version: 1,
    createdAt: now,
    updatedAt: now,
  } satisfies EventValues;
  validateEventRecord(record);
  db.insert(events).values(record).run();
  writeChange(client, op, "event", id, 1, diff(events, {}, record), now);
  return { id, version: 1, changed: true };
}

function createEdition(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "createEdition" }>,
  now: string,
): CatalogOperationResult {
  eventRow(client, op.eventId);
  const db = drizzle(client);
  const id = randomUUID();
  const data = editionData(op.data);
  const record = {
    id,
    eventId: op.eventId,
    ...data,
    publicationState: "draft" as const,
    dateState: data.dateState ?? "unknown",
    scheduleStatus: data.scheduleStatus ?? "announced",
    coordinatePrecision: data.coordinatePrecision ?? "unknown",
    version: 1,
    createdAt: now,
    updatedAt: now,
  } satisfies EditionValues;
  validateEdition(record);
  db.insert(editions).values(record).run();
  writeChange(client, op, "edition", id, 1, diff(editions, {}, record), now);
  return { id, version: 1, changed: true };
}

function updateSubject(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "updateEvent" | "updateEdition" }>,
  now: string,
): CatalogOperationResult {
  const db = drizzle(client);
  if (op.kind === "updateEvent") {
    const old = eventRow(client, op.id);
    assert(old.version === op.expectedVersion, "Stale subject version");
    const data = withoutUndefined(op.data);
    const changes = diff(events, old, data);
    if (!changes.length) {
      return { id: op.id, version: op.expectedVersion, changed: false };
    }
    if (data.slug !== undefined && data.slug !== old.slug) {
      const reserved = db
        .select({ eventId: urlAliases.eventId })
        .from(urlAliases)
        .where(eq(urlAliases.path, `/events/${data.slug}`))
        .get();
      assert(
        !reserved || reserved.eventId === op.id,
        "Public URL is reserved by another identity",
      );
      if (old.publicationState === "published") {
        reserveEventPaths(client, old, now);
        reserveEventPaths(client, { ...old, ...data }, now);
      }
    }
    bumpEvent(client, op.id, op.expectedVersion, data, now);
    writeChange(
      client,
      op,
      "event",
      op.id,
      op.expectedVersion + 1,
      changes,
      now,
    );
  } else {
    const old = editionRow(client, op.id);
    assert(old.version === op.expectedVersion, "Stale subject version");
    const data = editionData(op.data);
    const changes = diff(editions, old, data);
    if (!changes.length) {
      return { id: op.id, version: op.expectedVersion, changed: false };
    }
    bumpEdition(client, op.id, op.expectedVersion, data, now);
    writeChange(
      client,
      op,
      "edition",
      op.id,
      op.expectedVersion + 1,
      changes,
      now,
    );
  }
  return {
    id: op.id,
    version: op.expectedVersion + 1,
    changed: true,
  };
}

function changePublication(
  client: Database.Database,
  op: Extract<
    CatalogOperation,
    {
      kind:
        "publishEvent" | "publishEdition" | "withdrawEvent" | "withdrawEdition";
    }
  >,
  now: string,
): CatalogOperationResult {
  const isEvent = op.kind.endsWith("Event");
  const target = op.kind.startsWith("publish") ? "published" : "withdrawn";
  if (isEvent) {
    const old = eventRow(client, op.id);
    assert(old.version === op.expectedVersion, "Stale subject version");
    assert(
      old.publicationState !== "draft" || target === "published",
      "Cannot withdraw a draft",
    );
    if (target === "published") {
      assert(
        drizzle(client)
          .select({ id: editions.id })
          .from(editions)
          .where(
            and(
              eq(editions.eventId, op.id),
              eq(editions.publicationState, "published"),
            ),
          )
          .get(),
        "Event publication needs a published edition",
      );
      assert(
        old.homeScope == null || old.homeScope === "festivals",
        "Invalid home scope",
      );
    }
    const values: Partial<EventValues> = {
      publicationState: target,
      ...(target === "published" && old.homeScope == null
        ? { homeScope: "festivals" }
        : {}),
    };
    const changes = diff(events, old, values);
    if (!changes.length) {
      return { id: op.id, version: op.expectedVersion, changed: false };
    }
    if (target === "published") {
      reserveEventPaths(client, { ...old, ...values }, now);
    }
    bumpEvent(client, op.id, op.expectedVersion, values, now);
    writeChange(
      client,
      op,
      "event",
      op.id,
      op.expectedVersion + 1,
      changes,
      now,
    );
  } else {
    const old = editionRow(client, op.id);
    assert(old.version === op.expectedVersion, "Stale subject version");
    assert(
      old.publicationState !== "draft" || target === "published",
      "Cannot withdraw a draft",
    );
    if (target === "published") {
      validateEdition({ ...old, publicationState: "published" });
      validateScope(client, op.id);
    }
    const values: Partial<EditionValues> = { publicationState: target };
    const changes = diff(editions, old, values);
    if (!changes.length) {
      return { id: op.id, version: op.expectedVersion, changed: false };
    }
    if (target === "published") {
      reserveEditionPath(client, old, now);
    }
    bumpEdition(client, op.id, op.expectedVersion, values, now);
    writeChange(
      client,
      op,
      "edition",
      op.id,
      op.expectedVersion + 1,
      changes,
      now,
    );
  }
  return {
    id: op.id,
    version: op.expectedVersion + 1,
    changed: true,
  };
}

function replacePriceBlock(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "replacePriceBlock" }>,
  now: string,
): CatalogOperationResult {
  const old = editionRow(client, op.id);
  assert(old.version === op.expectedVersion, "Stale subject version");
  const details = normalizedPriceDetails(op.priceDetails);
  const data = { ...priceColumns(op.basePrice), priceDetails: details };
  const changes = diff(editions, old, data);
  if (!changes.length) {
    return { id: op.id, version: op.expectedVersion, changed: false };
  }
  bumpEdition(client, op.id, op.expectedVersion, data, now);
  writeChange(
    client,
    op,
    "edition",
    op.id,
    op.expectedVersion + 1,
    changes,
    now,
  );
  return {
    id: op.id,
    version: op.expectedVersion + 1,
    changed: true,
  };
}

function replaceTerms(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "replaceTerms" }>,
  now: string,
): CatalogOperationResult {
  const db = drizzle(client);
  const old = editionRow(client, op.id);
  assert(old.version === op.expectedVersion, "Stale subject version");
  // IDs use a locale-independent order for no-op comparisons and audit history.
  // eslint-disable-next-line sonarjs/no-alphabetical-sort
  const ids = [...new Set(op.termIds)].sort();
  assert(ids.length === op.termIds.length, "Duplicate term ID");
  const knownTerms = new Map(
    db
      .select({
        id: taxonomyTerms.id,
        facet: taxonomyTerms.facet,
        parentId: taxonomyTerms.parentId,
      })
      .from(taxonomyTerms)
      .all()
      .map((term) => [term.id, term]),
  );
  const terms = ids.map((id) => knownTerms.get(id));
  assert(terms.every(Boolean), "Unknown taxonomy term");
  validateTermAssignments(terms.filter((term) => term !== undefined));
  for (const t of terms) {
    let parentId = t?.parentId;
    const seen = new Set<string>();
    while (parentId) {
      assert(!seen.has(parentId), "Taxonomy parent cycle");
      seen.add(parentId);
      assert(!ids.includes(parentId), "Do not assign redundant ancestor term");
      parentId = knownTerms.get(parentId)?.parentId;
    }
  }
  const previous = db
    .select({ termId: editionTerms.termId })
    .from(editionTerms)
    .where(eq(editionTerms.editionId, op.id))
    .orderBy(asc(editionTerms.termId))
    .all()
    .map((x) => x.termId);
  const changed = JSON.stringify(previous) !== JSON.stringify(ids);
  if (!changed) {
    return { id: op.id, version: op.expectedVersion, changed: false };
  }
  db.delete(editionTerms).where(eq(editionTerms.editionId, op.id)).run();
  for (const id of ids) {
    db.insert(editionTerms).values({ editionId: op.id, termId: id }).run();
  }
  if (old.publicationState === "published") {
    validateScope(client, op.id);
  }
  bumpEdition(client, op.id, op.expectedVersion, {}, now);
  writeChange(
    client,
    op,
    "edition",
    op.id,
    op.expectedVersion + 1,
    [{ field: "terms", oldValue: previous, newValue: ids }],
    now,
  );
  return {
    id: op.id,
    version: op.expectedVersion + 1,
    changed: true,
  };
}

function replaceLinks(
  client: Database.Database,
  op: Extract<CatalogOperation, { kind: "replaceLinks" }>,
  now: string,
): CatalogOperationResult {
  const db = drizzle(client);
  const old =
    op.owner.type === "event"
      ? eventRow(client, op.owner.id)
      : editionRow(client, op.owner.id);
  assert(old.version === op.expectedVersion, "Stale subject version");
  const ownerColumn =
    op.owner.type === "event" ? externalLinks.eventId : externalLinks.editionId;
  const normalize = (links: typeof op.links) =>
    links
      .map((l) => ({
        kind: l.kind,
        url: normalizeCatalogUrl(l.url),
        label: l.label ?? null,
        official: l.official,
      }))
      .sort((a, b) => `${a.kind}:${a.url}`.localeCompare(`${b.kind}:${b.url}`));
  const desired = normalize(op.links);
  assert(
    new Set(desired.map((l) => `${l.kind}:${l.url}`)).size === desired.length,
    "Duplicate link",
  );
  const existingRows = db
    .select({
      id: externalLinks.id,
      kind: externalLinks.kind,
      url: externalLinks.url,
      label: externalLinks.label,
      official: externalLinks.official,
    })
    .from(externalLinks)
    .where(eq(ownerColumn, op.owner.id))
    .all();
  const previous = normalize(existingRows);
  const changed = JSON.stringify(previous) !== JSON.stringify(desired);
  if (!changed) {
    return { id: op.owner.id, version: op.expectedVersion, changed: false };
  }
  const wanted = new Map(desired.map((l) => [`${l.kind}:${l.url}`, l]));
  const priorByKey = new Map(
    existingRows.map((l) => [`${l.kind}:${normalizeCatalogUrl(l.url)}`, l]),
  );
  for (const existingLink of existingRows) {
    if (
      !wanted.has(
        `${existingLink.kind}:${normalizeCatalogUrl(existingLink.url)}`,
      )
    ) {
      db.delete(externalLinks)
        .where(eq(externalLinks.id, existingLink.id))
        .run();
    }
  }
  for (const link of desired) {
    const priorLink = priorByKey.get(`${link.kind}:${link.url}`);
    if (!priorLink) {
      db.insert(externalLinks)
        .values({
          id: randomUUID(),
          eventId: op.owner.type === "event" ? op.owner.id : null,
          editionId: op.owner.type === "edition" ? op.owner.id : null,
          kind: link.kind,
          url: link.url,
          label: link.label,
          official: link.official,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } else if (
      priorLink.label !== link.label ||
      priorLink.official !== link.official
    ) {
      db.update(externalLinks)
        .set({
          label: link.label,
          official: link.official,
          updatedAt: now,
        })
        .where(eq(externalLinks.id, priorLink.id))
        .run();
    }
  }
  if (op.owner.type === "event") {
    bumpEvent(client, op.owner.id, op.expectedVersion, {}, now);
  } else {
    bumpEdition(client, op.owner.id, op.expectedVersion, {}, now);
  }
  writeChange(
    client,
    op,
    op.owner.type,
    op.owner.id,
    op.expectedVersion + 1,
    [{ field: "links", oldValue: previous, newValue: desired }],
    now,
  );
  return {
    id: op.owner.id,
    version: op.expectedVersion + 1,
    changed: true,
  };
}

function applyOperation(
  client: Database.Database,
  op: CatalogOperation,
  now: string,
): CatalogOperationResult {
  switch (op.kind) {
    case "createEvent":
      return createEvent(client, op, now);
    case "createEdition":
      return createEdition(client, op, now);
    case "updateEvent":
    case "updateEdition":
      return updateSubject(client, op, now);
    case "publishEvent":
    case "publishEdition":
    case "withdrawEvent":
    case "withdrawEdition":
      return changePublication(client, op, now);
    case "replacePriceBlock":
      return replacePriceBlock(client, op, now);
    case "replaceTerms":
      return replaceTerms(client, op, now);
    case "replaceLinks":
      return replaceLinks(client, op, now);
  }
}

export function applyCatalogOperation(
  client: Database.Database,
  input: CatalogOperation,
) {
  const op = catalogOperationSchema.parse(input);
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(op))
    .digest("hex");
  return drizzle(client).transaction((db) => {
    const prior = db
      .select({
        payloadHash: operationReceipts.payloadHash,
        result: operationReceipts.result,
      })
      .from(operationReceipts)
      .where(eq(operationReceipts.operationKey, op.operationKey))
      .get();
    if (prior) {
      assert(
        prior.payloadHash === payloadHash,
        "Operation key reused with different payload",
      );
      return prior.result as CatalogOperationResult;
    }
    const now = new Date().toISOString();
    const result = applyOperation(client, op, now);
    db.insert(operationReceipts)
      .values({
        operationKey: op.operationKey,
        payloadHash,
        result,
        appliedAt: now,
      })
      .run();
    return result;
  });
}

export type CatalogItemResult = {
  operations: CatalogOperationResult[];
  references: Record<string, string>;
  changes: Array<typeof catalogChanges.$inferSelect>;
};

/** Apply dependent operations atomically; dry runs roll back the same transaction. */
export function applyCatalogItem(
  client: Database.Database,
  operations: CatalogOperation[],
  options: {
    dryRun?: boolean;
    beforeApply?: (client: Database.Database) => void;
  } = {},
): CatalogItemResult {
  assert(operations.length > 0, "Catalog item needs an operation");
  const run = (working: Database.Database) =>
    working.transaction(() => {
      options.beforeApply?.(working);
      const references: Record<string, string> = {};
      const results: CatalogOperationResult[] = [];
      const itemVersions = new Map<string, number>();
      const resolve = (value: string) => {
        if (!value.startsWith("$")) {
          return value;
        }
        const found = references[value.slice(1)];
        assert(found, `Unknown temporary reference: ${value}`);
        return found;
      };
      for (const input of operations) {
        const op = structuredClone(input);
        if ("eventId" in op) {
          op.eventId = resolve(op.eventId);
        }
        if ("id" in op) {
          op.id = resolve(op.id);
        }
        if ("owner" in op) {
          op.owner.id = resolve(op.owner.id);
        }
        let subject: string | undefined;
        if ("id" in op) {
          subject = op.id;
        } else if ("owner" in op) {
          subject = op.owner.id;
        }
        if (subject && "expectedVersion" in op) {
          op.expectedVersion = itemVersions.get(subject) ?? op.expectedVersion;
        }
        const result = applyCatalogOperation(working, op);
        results.push(result);
        if (subject) {
          itemVersions.set(subject, result.version);
        }
        if (op.tempKey) {
          assert(
            !references[op.tempKey],
            `Duplicate temporary key: ${op.tempKey}`,
          );
          references[op.tempKey] = result.id;
          itemVersions.set(result.id, result.version);
        }
      }
      const keys = operations.map((operation) => operation.operationKey);
      const changes = drizzle(working)
        .select()
        .from(catalogChanges)
        .where(inArray(catalogChanges.operationKey, keys))
        .all()
        .sort(
          (a, b) => keys.indexOf(a.operationKey) - keys.indexOf(b.operationKey),
        );
      return { operations: results, references, changes };
    })();
  if (!options.dryRun) {
    return run(client);
  }
  const rollback = new Error("dry-run rollback");
  let preview: CatalogItemResult | undefined;
  try {
    client.transaction(() => {
      preview = run(client);
      throw rollback;
    })();
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  }
  return preview!;
}
