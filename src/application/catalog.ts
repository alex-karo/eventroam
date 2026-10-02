import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import {
  catalogChanges,
  events,
  externalLinks,
  ingestionRuns,
  occurrenceTerms,
  occurrences,
  operationReceipts,
  taxonomyTerms,
  urlAliases,
} from "../db/schema";
import { isAssignedCountryCode } from "../domain/country-codes";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const localDate = z.iso.date();
const url = z.url().refine((value) => /^https?:\/\//.test(value));
const common = z
  .object({
    operationKey: z.string().min(1).max(200),
    actor: z.string().min(1).max(200),
    initiatedBy: z.string().min(1).max(200).optional(),
    ingestionRunId: z.string().optional(),
    note: z.string().max(500).optional(),
  })
  .strict();
const price = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("free"),
      minMinor: z.literal(0),
      maxMinor: z.literal(0),
      coverage: z.literal("full_programme"),
      qualification: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["exact", "from", "range"]),
      currency: z.string().regex(/^[A-Z]{3}$/),
      minMinor: z.number().int().nonnegative().safe(),
      maxMinor: z.number().int().nonnegative().safe(),
      coverage: z.enum(["full_programme", "day", "package"]),
      qualification: z.string().max(500).optional(),
    })
    .strict()
    .refine((p) =>
      p.kind === "range" ? p.maxMinor > p.minMinor : p.maxMinor === p.minMinor,
    ),
]);
const eventData = z
  .object({
    slug,
    canonicalName: z.string().trim().min(1).max(250),
    aliases: z.array(z.string().trim().min(1).max(250)).max(30).optional(),
    summary: z.string().max(2000).nullable().optional(),
  })
  .strict();
const occurrenceData = z
  .object({
    occurrenceKey: slug,
    displayName: z.string().trim().min(1).max(250).nullable().optional(),
    occurrenceYear: z.number().int().min(1).max(9999).nullable().optional(),
    startsOn: localDate.nullable().optional(),
    endsOn: localDate.nullable().optional(),
    dateState: z.enum(["unknown", "provisional", "confirmed"]).optional(),
    scheduleStatus: z
      .enum(["announced", "scheduled", "postponed", "cancelled"])
      .optional(),
    ticketAvailability: z.enum(["unknown", "available", "sold_out"]).optional(),
    capacityEstimate: z.number().int().positive().safe().nullable().optional(),
    venueName: z.string().trim().min(1).max(250).nullable().optional(),
    venueAddress: z.string().trim().min(1).max(500).nullable().optional(),
    locality: z.string().trim().min(1).max(250).nullable().optional(),
    administrativeArea: z.string().trim().min(1).max(250).nullable().optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .refine(
        isAssignedCountryCode,
        "Country code is not assigned by ISO 3166-1",
      )
      .nullable()
      .optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    coordinatePrecision: z
      .enum(["unknown", "exact", "approximate", "locality", "region"])
      .optional(),
    timeZone: z.string().max(100).nullable().optional(),
    price: price.nullable().optional(),
  })
  .strict();
const operation = z.discriminatedUnion("kind", [
  common.extend({ kind: z.literal("createEvent"), data: eventData }),
  common.extend({
    kind: z.literal("updateEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    data: eventData.partial(),
  }),
  common.extend({
    kind: z.literal("createOccurrence"),
    eventId: z.string().min(1),
    data: occurrenceData.required({ occurrenceKey: true }),
  }),
  common.extend({
    kind: z.literal("updateOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    data: occurrenceData.omit({ occurrenceKey: true }).partial(),
  }),
  common.extend({
    kind: z.literal("publishEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("publishOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawEvent"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("withdrawOccurrence"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  common.extend({
    kind: z.literal("replaceTerms"),
    id: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    termIds: z.array(z.string().min(1)).max(50),
  }),
  common.extend({
    kind: z.literal("replaceLinks"),
    owner: z.discriminatedUnion("type", [
      z.object({ type: z.literal("event"), id: z.string().min(1) }),
      z.object({ type: z.literal("occurrence"), id: z.string().min(1) }),
    ]),
    expectedVersion: z.number().int().positive(),
    links: z
      .array(
        z
          .object({
            kind: z.enum([
              "official_site",
              "instagram",
              "facebook",
              "youtube",
              "tiktok",
              "ticketing",
              "other",
            ]),
            url,
            label: z.string().max(250).nullable().optional(),
            official: z.boolean(),
            sourceId: z.string().nullable().optional(),
          })
          .strict(),
      )
      .max(30),
  }),
]);
export type CatalogOperation = z.input<typeof operation>;
type Row = Record<string, unknown>;
const columns: Record<string, string> = {
  canonicalName: "canonical_name",
  occurrenceKey: "occurrence_key",
  occurrenceYear: "occurrence_year",
  startsOn: "starts_on",
  endsOn: "ends_on",
  dateState: "date_state",
  scheduleStatus: "schedule_status",
  ticketAvailability: "ticket_availability",
  capacityEstimate: "capacity_estimate",
  displayName: "display_name",
  venueName: "venue_name",
  venueAddress: "venue_address",
  administrativeArea: "administrative_area",
  countryCode: "country_code",
  coordinatePrecision: "coordinate_precision",
  timeZone: "time_zone",
  homeScope: "home_scope",
  publicationState: "publication_state",
};
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function columnNames(table: "events" | "occurrences") {
  const schema = table === "events" ? events : occurrences;
  return Object.fromEntries(
    Object.entries(getTableColumns(schema)).map(([property, column]) => [
      column.name,
      property,
    ]),
  ) as Record<string, string>;
}
function rawRow(
  table: "events" | "occurrences",
  values: Record<string, unknown>,
): Row {
  const names = columnNames(table);
  return Object.fromEntries(
    Object.entries(values).map(([property, value]) => {
      const name = Object.keys(names).find((key) => names[key] === property);
      assert(name, `Unknown ${table} column: ${property}`);
      return [name, property === "aliases" ? JSON.stringify(value) : value];
    }),
  );
}
function typedValues(table: "events" | "occurrences", values: Row) {
  const names = columnNames(table);
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      const property = names[name];
      assert(property, `Unknown ${table} column: ${name}`);
      return [
        property,
        property === "aliases" ? JSON.parse(value as string) : value,
      ];
    }),
  );
}
function row(
  client: Database.Database,
  table: "events" | "occurrences",
  id: string,
): Row {
  const db = drizzle(client);
  const found =
    table === "events"
      ? db.select().from(events).where(eq(events.id, id)).get()
      : db.select().from(occurrences).where(eq(occurrences.id, id)).get();
  assert(found, `${table} record not found`);
  return rawRow(table, found);
}
function normalUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  )
    parsed.port = "";
  return parsed.toString();
}
function sqlData(data: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "price") {
      const p = value as z.infer<typeof price> | null;
      Object.assign(out, {
        price_kind: p?.kind ?? null,
        price_currency: p && "currency" in p ? p.currency : null,
        price_min_minor: p?.minMinor ?? null,
        price_max_minor: p?.maxMinor ?? null,
        price_coverage: p?.coverage ?? null,
        price_qualification: p?.qualification ?? null,
      });
    } else if (key === "aliases") out.aliases = JSON.stringify(value);
    else out[columns[key] ?? key] = value;
  }
  return out;
}
function validateOccurrence(r: Row) {
  const start = r.starts_on,
    end = r.ends_on;
  if (r.country_code != null)
    assert(
      typeof r.country_code === "string" &&
        isAssignedCountryCode(r.country_code),
      "Country code is not assigned by ISO 3166-1",
    );
  assert((start == null) === (end == null), "Date pair is incomplete");
  assert(
    start == null
      ? r.date_state === "unknown"
      : r.date_state === "provisional" || r.date_state === "confirmed",
    "Date state conflicts with dates",
  );
  assert(
    start == null ||
      (typeof start === "string" && typeof end === "string" && end >= start),
    "End date precedes start date",
  );
  assert(
    r.schedule_status !== "scheduled" || start != null,
    "Scheduled occurrence needs dates",
  );
  assert(
    (r.latitude == null) === (r.longitude == null),
    "Coordinate pair is incomplete",
  );
  assert(
    r.latitude == null
      ? r.coordinate_precision === "unknown"
      : r.coordinate_precision !== "unknown",
    "Coordinate precision conflicts with coordinates",
  );
  if (r.time_zone != null) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: r.time_zone as string });
    } catch {
      throw new Error("Invalid IANA time zone");
    }
  }
  if (r.publication_state === "published") {
    assert(
      start != null && end != null && r.occurrence_year != null,
      "Publication needs supported dates and year",
    );
    assert(
      r.country_code != null &&
        (r.venue_name != null ||
          r.locality != null ||
          r.administrative_area != null),
      "Publication needs country and supported area",
    );
  }
}
function setRow(
  client: Database.Database,
  table: "events" | "occurrences",
  id: string,
  values: Row,
) {
  const keys = Object.keys(values);
  if (!keys.length) return;
  const db = drizzle(client);
  if (table === "events")
    db.update(events)
      .set(typedValues(table, values))
      .where(eq(events.id, id))
      .run();
  else
    db.update(occurrences)
      .set(typedValues(table, values))
      .where(eq(occurrences.id, id))
      .run();
}
function insertRow(
  client: Database.Database,
  table: "events" | "occurrences",
  values: Row,
) {
  const db = drizzle(client);
  if (table === "events")
    db.insert(events)
      .values(typedValues(table, values) as typeof events.$inferInsert)
      .run();
  else
    db.insert(occurrences)
      .values(typedValues(table, values) as typeof occurrences.$inferInsert)
      .run();
}
function diff(old: Row, next: Row) {
  const valueFor = (field: string, value: unknown) =>
    field === "aliases" && typeof value === "string"
      ? (JSON.parse(value) as string[])
      : value;
  return Object.entries(next)
    .filter(([key, value]) => old[key] !== value)
    .map(([field, newValue]) => ({
      field,
      oldPresent: Object.hasOwn(old, field),
      oldValue: valueFor(field, old[field] ?? null),
      newValue: valueFor(field, newValue ?? null),
    }));
}
function validateScope(client: Database.Database, id: string) {
  const terms = drizzle(client)
    .select({ facet: taxonomyTerms.facet, slug: taxonomyTerms.slug })
    .from(occurrenceTerms)
    .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, occurrenceTerms.termId))
    .where(eq(occurrenceTerms.occurrenceId, id))
    .all();
  const has = (facet: string, slug: string) =>
    terms.some((t) => t.facet === facet && t.slug === slug);
  assert(
    has("format", "outdoor") || has("format", "mixed-indoor-outdoor"),
    "Festival scope requires supported outdoor format",
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
  meta: z.infer<typeof common>,
  subject: "event" | "occurrence",
  id: string,
  version: number,
  changes: unknown[],
  now: string,
) {
  const changeId = randomUUID();
  const db = drizzle(client);
  db.insert(catalogChanges)
    .values({
      id: changeId,
      eventId: subject === "event" ? id : null,
      occurrenceId: subject === "occurrence" ? id : null,
      subjectVersion: version,
      changedFields: changes,
      operationKey: meta.operationKey,
      ingestionRunId: meta.ingestionRunId ?? null,
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
  occurrenceId: string | null,
  now: string,
) {
  const db = drizzle(client);
  const existing = db
    .select({
      eventId: urlAliases.eventId,
      occurrenceId: urlAliases.occurrenceId,
    })
    .from(urlAliases)
    .where(and(eq(urlAliases.scope, scope), eq(urlAliases.path, path)))
    .get();
  assert(
    !existing ||
      (existing.eventId === eventId && existing.occurrenceId === occurrenceId),
    "Public URL is reserved by another identity",
  );
  if (!existing)
    db.insert(urlAliases)
      .values({ scope, path, eventId, occurrenceId, createdAt: now })
      .run();
}
function reserveEventPaths(client: Database.Database, event: Row, now: string) {
  const scope = event.home_scope as string;
  const eventId = event.id as string;
  alias(client, scope, `/events/${event.slug}`, eventId, null, now);
  const children = drizzle(client)
    .select({
      id: occurrences.id,
      occurrenceKey: occurrences.occurrenceKey,
      publicationState: occurrences.publicationState,
    })
    .from(occurrences)
    .where(eq(occurrences.eventId, eventId))
    .all();
  for (const child of children)
    if (child.publicationState === "published")
      alias(
        client,
        scope,
        `/events/${event.slug}/${child.occurrenceKey}`,
        eventId,
        child.id,
        now,
      );
}
function reserveOccurrencePath(
  client: Database.Database,
  occ: Row,
  now: string,
) {
  const event = row(client, "events", occ.event_id as string);
  if (event.home_scope)
    alias(
      client,
      event.home_scope as string,
      `/events/${event.slug}/${occ.occurrence_key}`,
      event.id as string,
      occ.id as string,
      now,
    );
}
function bump(
  client: Database.Database,
  table: "events" | "occurrences",
  id: string,
  version: number,
  values: Row,
  now: string,
) {
  setRow(client, table, id, {
    ...values,
    version: version + 1,
    updated_at: now,
  });
}
export function applyCatalogOperation(
  client: Database.Database,
  input: CatalogOperation,
) {
  const op = operation.parse(input);
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
      return prior.result as {
        id: string;
        version: number;
        changed: boolean;
      };
    }
    if (op.ingestionRunId) {
      const run = db
        .select({ mode: ingestionRuns.mode, status: ingestionRuns.status })
        .from(ingestionRuns)
        .where(eq(ingestionRuns.id, op.ingestionRunId))
        .get();
      assert(
        run?.mode === "apply" && run.status === "running",
        "Catalog writes require an active apply run",
      );
    }
    const now = new Date().toISOString();
    let result: { id: string; version: number; changed: boolean };
    if (op.kind === "createEvent") {
      const id = randomUUID();
      const data = sqlData(op.data);
      assert(
        !db
          .select({ path: urlAliases.path })
          .from(urlAliases)
          .where(eq(urlAliases.path, `/events/${data.slug}`))
          .get(),
        "Public URL is reserved by another identity",
      );
      const record = {
        id,
        ...data,
        aliases: data.aliases ?? "[]",
        home_scope: null,
        publication_state: "draft",
        version: 1,
        created_at: now,
        updated_at: now,
      };
      insertRow(client, "events", record);
      writeChange(client, op, "event", id, 1, diff({}, record), now);
      result = { id, version: 1, changed: true };
    } else if (op.kind === "createOccurrence") {
      row(client, "events", op.eventId);
      const id = randomUUID();
      const data = sqlData(op.data);
      const record = {
        id,
        event_id: op.eventId,
        ...data,
        publication_state: "draft",
        date_state: data.date_state ?? "unknown",
        schedule_status: data.schedule_status ?? "announced",
        ticket_availability: data.ticket_availability ?? "unknown",
        coordinate_precision: data.coordinate_precision ?? "unknown",
        version: 1,
        created_at: now,
        updated_at: now,
      };
      validateOccurrence(record);
      insertRow(client, "occurrences", record);
      writeChange(client, op, "occurrence", id, 1, diff({}, record), now);
      result = { id, version: 1, changed: true };
    } else if (op.kind === "updateEvent" || op.kind === "updateOccurrence") {
      const table = op.kind === "updateEvent" ? "events" : "occurrences";
      const old = row(client, table, op.id);
      assert(old.version === op.expectedVersion, "Stale subject version");
      const data = sqlData(op.data);
      const changes = diff(old, data);
      if (changes.length) {
        const updated = { ...old, ...data };
        if (table === "occurrences") validateOccurrence(updated);
        if (
          table === "events" &&
          data.slug !== undefined &&
          data.slug !== old.slug
        ) {
          const reserved = db
            .select({ eventId: urlAliases.eventId })
            .from(urlAliases)
            .where(eq(urlAliases.path, `/events/${data.slug}`))
            .get();
          assert(
            !reserved || reserved.eventId === op.id,
            "Public URL is reserved by another identity",
          );
        }
        if (
          table === "events" &&
          old.publication_state === "published" &&
          data.slug !== undefined &&
          data.slug !== old.slug
        ) {
          reserveEventPaths(client, old, now);
          reserveEventPaths(client, updated, now);
        }
        bump(client, table, op.id, op.expectedVersion, data, now);
        writeChange(
          client,
          op,
          table === "events" ? "event" : "occurrence",
          op.id,
          op.expectedVersion + 1,
          changes,
          now,
        );
      }
      result = {
        id: op.id,
        version: op.expectedVersion + (changes.length ? 1 : 0),
        changed: changes.length > 0,
      };
    } else if (
      op.kind === "publishEvent" ||
      op.kind === "publishOccurrence" ||
      op.kind === "withdrawEvent" ||
      op.kind === "withdrawOccurrence"
    ) {
      const isEvent = op.kind.endsWith("Event");
      const table = isEvent ? "events" : "occurrences";
      const old = row(client, table, op.id);
      assert(old.version === op.expectedVersion, "Stale subject version");
      const target = op.kind.startsWith("publish") ? "published" : "withdrawn";
      assert(
        old.publication_state !== "draft" || target === "published",
        "Cannot withdraw a draft",
      );
      if (target === "published") {
        if (isEvent) {
          assert(
            db
              .select({ id: occurrences.id })
              .from(occurrences)
              .where(
                and(
                  eq(occurrences.eventId, op.id),
                  eq(occurrences.publicationState, "published"),
                ),
              )
              .get(),
            "Event publication needs a published occurrence",
          );
          assert(
            old.home_scope == null || old.home_scope === "festivals",
            "Invalid home scope",
          );
        } else {
          validateOccurrence({ ...old, publication_state: "published" });
          validateScope(client, op.id);
        }
      }
      const values: Row = { publication_state: target };
      if (isEvent && target === "published" && old.home_scope == null)
        values.home_scope = "festivals";
      const changes = diff(old, values);
      if (changes.length) {
        if (target === "published") {
          if (isEvent) reserveEventPaths(client, { ...old, ...values }, now);
          else reserveOccurrencePath(client, old, now);
        }
        bump(client, table, op.id, op.expectedVersion, values, now);
        writeChange(
          client,
          op,
          isEvent ? "event" : "occurrence",
          op.id,
          op.expectedVersion + 1,
          changes,
          now,
        );
      }
      result = {
        id: op.id,
        version: op.expectedVersion + (changes.length ? 1 : 0),
        changed: changes.length > 0,
      };
    } else if (op.kind === "replaceTerms") {
      const old = row(client, "occurrences", op.id);
      assert(old.version === op.expectedVersion, "Stale subject version");
      const ids = [...new Set(op.termIds)].sort();
      assert(ids.length === op.termIds.length, "Duplicate term ID");
      const terms = ids.map((id) =>
        db
          .select({
            id: taxonomyTerms.id,
            facet: taxonomyTerms.facet,
            parentId: taxonomyTerms.parentId,
          })
          .from(taxonomyTerms)
          .where(eq(taxonomyTerms.id, id))
          .get(),
      );
      assert(terms.every(Boolean), "Unknown taxonomy term");
      for (const facet of ["event_type", "format"])
        assert(
          terms.filter((t) => t?.facet === facet).length <= 1,
          `Only one ${facet} term allowed`,
        );
      for (const t of terms)
        if (t?.parentId)
          assert(
            !ids.includes(t.parentId),
            "Do not assign redundant parent genre",
          );
      const previous = db
        .select({ termId: occurrenceTerms.termId })
        .from(occurrenceTerms)
        .where(eq(occurrenceTerms.occurrenceId, op.id))
        .orderBy(asc(occurrenceTerms.termId))
        .all()
        .map((x) => x.termId);
      const changed = JSON.stringify(previous) !== JSON.stringify(ids);
      if (changed) {
        db.delete(occurrenceTerms)
          .where(eq(occurrenceTerms.occurrenceId, op.id))
          .run();
        for (const id of ids)
          db.insert(occurrenceTerms)
            .values({ occurrenceId: op.id, termId: id })
            .run();
        if (old.publication_state === "published") validateScope(client, op.id);
        bump(client, "occurrences", op.id, op.expectedVersion, {}, now);
        writeChange(
          client,
          op,
          "occurrence",
          op.id,
          op.expectedVersion + 1,
          [{ field: "terms", oldValue: previous, newValue: ids }],
          now,
        );
      }
      result = {
        id: op.id,
        version: op.expectedVersion + (changed ? 1 : 0),
        changed,
      };
    } else {
      const table = op.owner.type === "event" ? "events" : "occurrences";
      const old = row(client, table, op.owner.id);
      assert(old.version === op.expectedVersion, "Stale subject version");
      const ownerColumn =
        op.owner.type === "event"
          ? externalLinks.eventId
          : externalLinks.occurrenceId;
      const normalize = (links: typeof op.links) =>
        links
          .map((l) => ({
            kind: l.kind,
            url: normalUrl(l.url),
            label: l.label ?? null,
            official: l.official,
            sourceId: l.sourceId ?? null,
          }))
          .sort((a, b) =>
            `${a.kind}:${a.url}`.localeCompare(`${b.kind}:${b.url}`),
          );
      const desired = normalize(op.links);
      assert(
        new Set(desired.map((l) => `${l.kind}:${l.url}`)).size ===
          desired.length,
        "Duplicate link",
      );
      const existingRows = db
        .select({
          id: externalLinks.id,
          kind: externalLinks.kind,
          url: externalLinks.url,
          label: externalLinks.label,
          official: externalLinks.official,
          sourceId: externalLinks.sourceId,
        })
        .from(externalLinks)
        .where(eq(ownerColumn, op.owner.id))
        .all();
      const existing = existingRows.map((l) => ({
        kind: l.kind,
        url: l.url,
        label: l.label,
        official: l.official,
        sourceId: l.sourceId,
      }));
      const previous = normalize(existing);
      const changed = JSON.stringify(previous) !== JSON.stringify(desired);
      if (changed) {
        const wanted = new Map(desired.map((l) => [`${l.kind}:${l.url}`, l]));
        const priorByKey = new Map(
          existingRows.map((l) => [`${l.kind}:${normalUrl(l.url)}`, l]),
        );
        for (const existingLink of existingRows) {
          if (
            !wanted.has(`${existingLink.kind}:${normalUrl(existingLink.url)}`)
          )
            db.delete(externalLinks)
              .where(eq(externalLinks.id, existingLink.id))
              .run();
        }
        for (const link of desired) {
          const priorLink = priorByKey.get(`${link.kind}:${link.url}`);
          if (!priorLink)
            db.insert(externalLinks)
              .values({
                id: randomUUID(),
                eventId: op.owner.type === "event" ? op.owner.id : null,
                occurrenceId:
                  op.owner.type === "occurrence" ? op.owner.id : null,
                kind: link.kind,
                url: link.url,
                label: link.label,
                official: link.official,
                sourceId: link.sourceId,
                createdAt: now,
                updatedAt: now,
              })
              .run();
          else if (
            priorLink.label !== link.label ||
            priorLink.official !== link.official ||
            priorLink.sourceId !== link.sourceId
          )
            db.update(externalLinks)
              .set({
                label: link.label,
                official: link.official,
                sourceId: link.sourceId,
                updatedAt: now,
              })
              .where(eq(externalLinks.id, priorLink.id))
              .run();
        }
        bump(client, table, op.owner.id, op.expectedVersion, {}, now);
        writeChange(
          client,
          op,
          op.owner.type,
          op.owner.id,
          op.expectedVersion + 1,
          [{ field: "links", oldValue: previous, newValue: desired }],
          now,
        );
      }
      result = {
        id: op.owner.id,
        version: op.expectedVersion + (changed ? 1 : 0),
        changed,
      };
    }
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
