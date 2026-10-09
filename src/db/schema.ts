import { sql } from "drizzle-orm";
import {
  check,
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
  (t) => [
    uniqueIndex("events_slug_uq").on(t.slug),
    check("events_version_ck", sql`${t.version} > 0`),
  ],
);

export const occurrences = sqliteTable(
  "occurrences",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    occurrenceKey: text("occurrence_key").notNull(),
    displayName: text("display_name"),
    occurrenceYear: integer("occurrence_year"),
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
    capacityEstimate: integer("capacity_estimate"),
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
    uniqueIndex("occurrences_event_key_uq").on(t.eventId, t.occurrenceKey),
    index("occurrences_event_idx").on(t.eventId),
    index("occurrences_date_idx").on(t.startsOn, t.endsOn),
    index("occurrences_country_idx").on(t.countryCode),
    index("occurrences_coordinates_idx").on(t.latitude, t.longitude),
    check(
      "occurrences_dates_ck",
      sql`((${t.startsOn} IS NULL AND ${t.endsOn} IS NULL) OR (${t.startsOn} IS NOT NULL AND ${t.endsOn} IS NOT NULL AND ${t.endsOn} >= ${t.startsOn}))`,
    ),
    check(
      "occurrences_location_ck",
      sql`((${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180))`,
    ),
    check(
      "occurrences_capacity_ck",
      sql`${t.capacityEstimate} IS NULL OR ${t.capacityEstimate} > 0`,
    ),
    check("occurrences_version_ck", sql`${t.version} > 0`),
    check(
      "occurrences_price_details_ck",
      sql`json_valid(${t.priceDetails}) AND json_type(${t.priceDetails}) = 'array'`,
    ),
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
  (t) => [
    uniqueIndex("taxonomy_terms_facet_slug_uq").on(t.facet, t.slug),
    check(
      "taxonomy_terms_parent_ck",
      sql`${t.parentId} IS NULL OR ${t.parentId} != ${t.id}`,
    ),
  ],
);
export const occurrenceTerms = sqliteTable(
  "occurrence_terms",
  {
    occurrenceId: text("occurrence_id")
      .notNull()
      .references(() => occurrences.id),
    termId: text("term_id")
      .notNull()
      .references(() => taxonomyTerms.id),
  },
  (t) => [primaryKey({ columns: [t.occurrenceId, t.termId] })],
);
export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id),
    occurrenceId: text("occurrence_id").references(() => occurrences.id),
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
    check(
      "external_links_owner_ck",
      sql`(${t.eventId} IS NOT NULL) != (${t.occurrenceId} IS NOT NULL)`,
    ),
    uniqueIndex("external_links_event_uq").on(t.eventId, t.kind, t.url),
    uniqueIndex("external_links_occurrence_uq").on(
      t.occurrenceId,
      t.kind,
      t.url,
    ),
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
    occurrenceId: text("occurrence_id").references(() => occurrences.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.path] })],
);
export const catalogChanges = sqliteTable(
  "catalog_changes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id),
    occurrenceId: text("occurrence_id").references(() => occurrences.id),
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
    check(
      "catalog_changes_subject_ck",
      sql`(${t.eventId} IS NOT NULL) != (${t.occurrenceId} IS NOT NULL)`,
    ),
    check("catalog_changes_version_ck", sql`${t.subjectVersion} > 0`),
    uniqueIndex("catalog_changes_event_operation_uq").on(
      t.operationKey,
      t.eventId,
    ),
    uniqueIndex("catalog_changes_occurrence_operation_uq").on(
      t.operationKey,
      t.occurrenceId,
    ),
  ],
);
export const operationReceipts = sqliteTable("operation_receipts", {
  operationKey: text("operation_key").primaryKey(),
  payloadHash: text("payload_hash").notNull(),
  result: text("result", { mode: "json" }).$type<unknown>().notNull(),
  appliedAt: text("applied_at").notNull(),
});
