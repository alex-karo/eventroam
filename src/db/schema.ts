import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  type SQLiteColumn,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  publicationStates as lifecycle,
  facets,
  dateStates,
  scheduleStatuses,
  ticketAvailabilities,
  coordinatePrecisions,
  priceKinds,
  priceCoverages,
  linkKinds,
} from "@/catalog/domain/vocabulary";

export type CatalogFieldChange = {
  field: string;
  oldPresent?: boolean;
  oldValue: unknown;
  newValue: unknown;
};
export type StoredPriceDetail = {
  label: string;
  amount?: number;
  currency?: string;
  terms?: string;
  availability?: (typeof ticketAvailabilities)[number];
  url?: string;
};

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    canonicalName: text("canonical_name").notNull(),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    summary: text("summary"),
    homeScope: text("home_scope"),
    publicationState: text("publication_state", { enum: lifecycle })
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("events_slug_uq").on(t.slug)],
);

export const editions = sqliteTable(
  "editions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    editionKey: text("edition_key").notNull(),
    displayName: text("display_name"),
    editionYear: integer("edition_year"),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    dateState: text("date_state", {
      enum: dateStates,
    })
      .notNull()
      .default("unknown"),
    scheduleStatus: text("schedule_status", {
      enum: scheduleStatuses,
    })
      .notNull()
      .default("announced"),
    sizeEstimate: integer("size_estimate"),
    publicationState: text("publication_state", { enum: lifecycle })
      .notNull()
      .default("draft"),
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    locality: text("locality"),
    administrativeArea: text("administrative_area"),
    countryCode: text("country_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    coordinatePrecision: text("coordinate_precision", {
      enum: coordinatePrecisions,
    })
      .notNull()
      .default("unknown"),
    timeZone: text("time_zone"),
    priceKind: text("price_kind", { enum: priceKinds }),
    priceCurrency: text("price_currency"),
    priceMinMinor: integer("price_min_minor"),
    priceMaxMinor: integer("price_max_minor"),
    priceCoverage: text("price_coverage", {
      enum: priceCoverages,
    }),
    priceQualification: text("price_qualification"),
    priceDetails: text("price_details", { mode: "json" })
      .$type<StoredPriceDetail[]>()
      .notNull()
      .default(sql`'[]'`),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("editions_event_key_uq").on(t.eventId, t.editionKey),
    index("editions_event_idx").on(t.eventId),
    index("editions_date_idx").on(t.startsOn, t.endsOn),
    index("editions_country_idx").on(t.countryCode),
    index("editions_coordinates_idx").on(t.latitude, t.longitude),
  ],
);

export const taxonomyTerms = sqliteTable(
  "taxonomy_terms",
  {
    id: text("id").primaryKey(),
    facet: text("facet", { enum: facets }).notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id").references(
      (): SQLiteColumn => taxonomyTerms.id,
    ),
  },
  (t) => [uniqueIndex("taxonomy_terms_facet_slug_uq").on(t.facet, t.slug)],
);
export const editionTerms = sqliteTable(
  "edition_terms",
  {
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id),
    termId: text("term_id")
      .notNull()
      .references(() => taxonomyTerms.id),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.termId] })],
);
export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id),
    editionId: text("edition_id").references(() => editions.id),
    kind: text("kind", {
      enum: linkKinds,
    }).notNull(),
    url: text("url").notNull(),
    label: text("label"),
    official: integer("official", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("external_links_event_uq").on(t.eventId, t.kind, t.url),
    uniqueIndex("external_links_edition_uq").on(t.editionId, t.kind, t.url),
  ],
);
export const urlAliases = sqliteTable(
  "url_aliases",
  {
    scope: text("scope").notNull(),
    path: text("path").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    editionId: text("edition_id").references(() => editions.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.path] })],
);
export const catalogChanges = sqliteTable(
  "catalog_changes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id),
    editionId: text("edition_id").references(() => editions.id),
    subjectVersion: integer("subject_version").notNull(),
    changedFields: text("changed_fields", { mode: "json" })
      .$type<CatalogFieldChange[]>()
      .notNull(),
    operationKey: text("operation_key").notNull(),
    actor: text("actor").notNull(),
    initiatedBy: text("initiated_by"),
    changedAt: text("changed_at").notNull(),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("catalog_changes_event_operation_uq").on(
      t.operationKey,
      t.eventId,
    ),
    uniqueIndex("catalog_changes_edition_operation_uq").on(
      t.operationKey,
      t.editionId,
    ),
  ],
);
export const operationReceipts = sqliteTable("operation_receipts", {
  operationKey: text("operation_key").primaryKey(),
  payloadHash: text("payload_hash").notNull(),
  result: text("result", { mode: "json" }).$type<unknown>().notNull(),
  appliedAt: text("applied_at").notNull(),
});

/** Private attempt history. Event IDs may refer to deleted catalog records. */
export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: text("id").primaryKey(),
  eventId: text("event_id"),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  inputJson: text("input_json", { mode: "json" }).$type<unknown>().notNull(),
  reportJson: text("report_json", { mode: "json" }).$type<unknown>(),
  durationMs: integer("duration_ms"),
});
