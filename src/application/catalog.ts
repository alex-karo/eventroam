import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import { isAssignedCountryCode } from "../domain/country-codes";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const instant = z.iso.datetime({ offset: true });
const localDate = z.iso.date();
const url = z.url().refine((value) => /^https?:\/\//.test(value));
const evidenceItem = z
  .object({
    sourceId: z.string().min(1),
    inspectedUrl: url,
    retrievedAt: instant,
    authority: z.enum(["official", "partner", "secondary", "community"]),
    fieldPaths: z.array(z.string().min(1)).min(1).max(40),
    excerpt: z.string().trim().min(1).max(2000).optional(),
    snapshotRef: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((item) => item.excerpt || item.snapshotRef, {
    message: "Source evidence needs an excerpt or snapshot reference",
  });
const common = z.object({
  operationKey: z.string().min(1).max(200),
  actor: z.string().min(1).max(200),
  initiatedBy: z.string().min(1).max(200).optional(),
  ingestionRunId: z.string().optional(),
  evidence: z.array(evidenceItem).max(20).default([]),
  note: z.string().max(500).optional(),
});
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
type Evidence = z.infer<typeof evidenceItem>;
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
const factual = new Set([
  "slug",
  "canonical_name",
  "occurrence_year",
  "starts_on",
  "ends_on",
  "date_state",
  "schedule_status",
  "ticket_availability",
  "capacity_estimate",
  "venue_name",
  "venue_address",
  "locality",
  "administrative_area",
  "country_code",
  "latitude",
  "longitude",
  "coordinate_precision",
  "time_zone",
  "price_kind",
  "price_currency",
  "price_min_minor",
  "price_max_minor",
  "price_coverage",
  "price_qualification",
  "terms",
  "links",
  "publication_state",
]);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function row(
  client: Database.Database,
  table: "events" | "occurrences",
  id: string,
): Row {
  const found = client
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as Row | undefined;
  assert(found, `${table} record not found`);
  return found;
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
  if (keys.length)
    client
      .prepare(
        `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
      )
      .run(...keys.map((k) => values[k]), id);
}
function insertRow(
  client: Database.Database,
  table: "events" | "occurrences",
  values: Row,
) {
  const keys = Object.keys(values);
  client
    .prepare(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    )
    .run(...keys.map((k) => values[k]));
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
function evidenceFor(
  client: Database.Database,
  items: Evidence[],
  fields: string[],
  required: boolean,
) {
  if (required) assert(items.length > 0, "Source evidence required");
  for (const item of items)
    assert(
      client.prepare("SELECT id FROM sources WHERE id=?").get(item.sourceId),
      "Unknown evidence source",
    );
  const covered = fields.filter((f) => factual.has(f));
  if (required)
    assert(
      covered.every((f) => items.some((x) => x.fieldPaths.includes(f))),
      `Evidence must identify each factual field: ${covered.join(",")}`,
    );
}
function validateScope(client: Database.Database, id: string) {
  const terms = client
    .prepare(
      "SELECT t.facet,t.slug FROM occurrence_terms ot JOIN taxonomy_terms t ON t.id=ot.term_id WHERE ot.occurrence_id=?",
    )
    .all(id) as { facet: string; slug: string }[];
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
  client
    .prepare(
      "INSERT INTO catalog_changes (id,event_id,occurrence_id,subject_version,changed_fields,operation_key,ingestion_run_id,actor,initiated_by,changed_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      changeId,
      subject === "event" ? id : null,
      subject === "occurrence" ? id : null,
      version,
      JSON.stringify(changes),
      meta.operationKey,
      meta.ingestionRunId ?? null,
      meta.actor,
      meta.initiatedBy ?? null,
      now,
      meta.note ?? null,
    );
  for (const item of meta.evidence)
    client
      .prepare(
        "INSERT INTO change_evidence (id,change_id,source_id,field_paths,inspected_url,retrieved_at,authority,excerpt,snapshot_ref) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        changeId,
        item.sourceId,
        JSON.stringify(item.fieldPaths),
        normalUrl(item.inspectedUrl),
        new Date(item.retrievedAt).toISOString(),
        item.authority,
        item.excerpt ?? null,
        item.snapshotRef ?? null,
      );
}
function alias(
  client: Database.Database,
  scope: string,
  path: string,
  eventId: string,
  occurrenceId: string | null,
  now: string,
) {
  const existing = client
    .prepare(
      "SELECT event_id,occurrence_id FROM url_aliases WHERE scope=? AND path=?",
    )
    .get(scope, path) as
    { event_id: string; occurrence_id: string | null } | undefined;
  assert(
    !existing ||
      (existing.event_id === eventId &&
        existing.occurrence_id === occurrenceId),
    "Public URL is reserved by another identity",
  );
  if (!existing)
    client
      .prepare(
        "INSERT INTO url_aliases (scope,path,event_id,occurrence_id,created_at) VALUES (?,?,?,?,?)",
      )
      .run(scope, path, eventId, occurrenceId, now);
}
function reserveEventPaths(client: Database.Database, event: Row, now: string) {
  const scope = event.home_scope as string;
  const eventId = event.id as string;
  alias(client, scope, `/events/${event.slug}`, eventId, null, now);
  const children = client
    .prepare(
      "SELECT id,occurrence_key,publication_state FROM occurrences WHERE event_id=?",
    )
    .all(eventId) as Row[];
  for (const child of children)
    if (child.publication_state === "published")
      alias(
        client,
        scope,
        `/events/${event.slug}/${child.occurrence_key}`,
        eventId,
        child.id as string,
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
  return client.transaction(() => {
    const prior = client
      .prepare(
        "SELECT payload_hash,result FROM operation_receipts WHERE operation_key=?",
      )
      .get(op.operationKey) as
      { payload_hash: string; result: string } | undefined;
    if (prior) {
      assert(
        prior.payload_hash === payloadHash,
        "Operation key reused with different payload",
      );
      return JSON.parse(prior.result) as {
        id: string;
        version: number;
        changed: boolean;
      };
    }
    if (op.ingestionRunId) {
      const run = client
        .prepare("SELECT mode,status FROM ingestion_runs WHERE id=?")
        .get(op.ingestionRunId) as { mode: string; status: string } | undefined;
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
      evidenceFor(client, op.evidence, Object.keys(data), true);
      assert(
        !client
          .prepare("SELECT 1 FROM url_aliases WHERE path=? LIMIT 1")
          .get(`/events/${data.slug}`),
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
      evidenceFor(client, op.evidence, Object.keys(data), true);
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
        evidenceFor(
          client,
          op.evidence,
          changes.map((c) => c.field),
          changes.some((c) => factual.has(c.field)),
        );
        const updated = { ...old, ...data };
        if (table === "occurrences") validateOccurrence(updated);
        if (
          table === "events" &&
          data.slug !== undefined &&
          data.slug !== old.slug
        ) {
          const reserved = client
            .prepare("SELECT event_id FROM url_aliases WHERE path=? LIMIT 1")
            .get(`/events/${data.slug}`) as { event_id: string } | undefined;
          assert(
            !reserved || reserved.event_id === op.id,
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
          evidenceFor(
            client,
            op.evidence,
            ["publication_state", "canonical_name"],
            true,
          );
          assert(
            client
              .prepare(
                "SELECT 1 FROM occurrences WHERE event_id=? AND publication_state='published' LIMIT 1",
              )
              .get(op.id),
            "Event publication needs a published occurrence",
          );
          assert(
            old.home_scope == null || old.home_scope === "festivals",
            "Invalid home scope",
          );
        } else {
          validateOccurrence({ ...old, publication_state: "published" });
          validateScope(client, op.id);
          const location =
            old.venue_name != null
              ? "venue_name"
              : old.locality != null
                ? "locality"
                : "administrative_area";
          evidenceFor(
            client,
            op.evidence,
            [
              "publication_state",
              "starts_on",
              "ends_on",
              "date_state",
              "country_code",
              location,
              "terms",
            ],
            true,
          );
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
      const terms = ids.map(
        (id) =>
          client
            .prepare("SELECT id,facet,parent_id FROM taxonomy_terms WHERE id=?")
            .get(id) as
            { id: string; facet: string; parent_id: string | null } | undefined,
      );
      assert(terms.every(Boolean), "Unknown taxonomy term");
      for (const facet of ["event_type", "format"])
        assert(
          terms.filter((t) => t?.facet === facet).length <= 1,
          `Only one ${facet} term allowed`,
        );
      for (const t of terms)
        if (t?.parent_id)
          assert(
            !ids.includes(t.parent_id),
            "Do not assign redundant parent genre",
          );
      const previous = (
        client
          .prepare(
            "SELECT term_id FROM occurrence_terms WHERE occurrence_id=? ORDER BY term_id",
          )
          .all(op.id) as { term_id: string }[]
      ).map((x) => x.term_id);
      const changed = JSON.stringify(previous) !== JSON.stringify(ids);
      if (changed) {
        evidenceFor(client, op.evidence, ["terms"], true);
        client
          .prepare("DELETE FROM occurrence_terms WHERE occurrence_id=?")
          .run(op.id);
        for (const id of ids)
          client
            .prepare(
              "INSERT INTO occurrence_terms (occurrence_id,term_id) VALUES (?,?)",
            )
            .run(op.id, id);
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
        op.owner.type === "event" ? "event_id" : "occurrence_id";
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
      const existingRows = client
        .prepare(
          `SELECT id,kind,url,label,official,source_id FROM external_links WHERE ${ownerColumn}=?`,
        )
        .all(op.owner.id) as {
        id: string;
        kind: (typeof op.links)[number]["kind"];
        url: string;
        label: string | null;
        official: number;
        source_id: string | null;
      }[];
      const existing = existingRows.map((l) => ({
        kind: l.kind,
        url: l.url,
        label: l.label,
        official: Boolean(l.official),
        sourceId: l.source_id,
      }));
      const previous = normalize(existing);
      const changed = JSON.stringify(previous) !== JSON.stringify(desired);
      if (changed) {
        evidenceFor(client, op.evidence, ["links"], true);
        const wanted = new Map(desired.map((l) => [`${l.kind}:${l.url}`, l]));
        const priorByKey = new Map(
          existingRows.map((l) => [`${l.kind}:${normalUrl(l.url)}`, l]),
        );
        for (const existingLink of existingRows) {
          if (
            !wanted.has(`${existingLink.kind}:${normalUrl(existingLink.url)}`)
          )
            client
              .prepare("DELETE FROM external_links WHERE id=?")
              .run(existingLink.id);
        }
        for (const link of desired) {
          const priorLink = priorByKey.get(`${link.kind}:${link.url}`);
          if (!priorLink)
            client
              .prepare(
                `INSERT INTO external_links (id,${ownerColumn},kind,url,label,official,source_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
              )
              .run(
                randomUUID(),
                op.owner.id,
                link.kind,
                link.url,
                link.label,
                link.official ? 1 : 0,
                link.sourceId,
                now,
                now,
              );
          else if (
            priorLink.label !== link.label ||
            Boolean(priorLink.official) !== link.official ||
            priorLink.source_id !== link.sourceId
          )
            client
              .prepare(
                "UPDATE external_links SET label=?,official=?,source_id=?,updated_at=? WHERE id=?",
              )
              .run(
                link.label,
                link.official ? 1 : 0,
                link.sourceId,
                now,
                priorLink.id,
              );
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
    client
      .prepare(
        "INSERT INTO operation_receipts (operation_key,payload_hash,result,applied_at) VALUES (?,?,?,?)",
      )
      .run(op.operationKey, payloadHash, JSON.stringify(result), now);
    return result;
  })();
}
