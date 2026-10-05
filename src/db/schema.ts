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

const lifecycle = ["draft", "published", "withdrawn"] as const;
const facets = ["event_type", "format", "topic", "genre", "culture"] as const;

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
  availability?: "unknown" | "available" | "sold_out" | "closed";
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
    check(
      "events_state_ck",
      sql`${t.publicationState} IN ('draft','published','withdrawn')`,
    ),
    check(
      "events_scope_ck",
      sql`${t.homeScope} IS NULL OR ${t.homeScope} = 'festivals'`,
    ),
    check(
      "events_published_scope_ck",
      sql`${t.publicationState} != 'published' OR ${t.homeScope} IS NOT NULL`,
    ),
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
      enum: ["unknown", "provisional", "confirmed"],
    })
      .notNull()
      .default("unknown"),
    scheduleStatus: text("schedule_status", {
      enum: ["announced", "scheduled", "postponed", "cancelled"],
    })
      .notNull()
      .default("announced"),
    ticketAvailability: text("ticket_availability", {
      enum: ["unknown", "available", "sold_out", "closed"],
    })
      .notNull()
      .default("unknown"),
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
      enum: ["unknown", "exact", "approximate", "locality", "region"],
    })
      .notNull()
      .default("unknown"),
    timeZone: text("time_zone"),
    priceKind: text("price_kind", { enum: ["free", "exact", "from", "range"] }),
    priceCurrency: text("price_currency"),
    priceMinMinor: integer("price_min_minor"),
    priceMaxMinor: integer("price_max_minor"),
    priceCoverage: text("price_coverage", {
      enum: ["full_programme", "day", "package"],
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
      sql`((${t.startsOn} IS NULL AND ${t.endsOn} IS NULL AND ${t.dateState} = 'unknown') OR (${t.startsOn} IS NOT NULL AND ${t.endsOn} IS NOT NULL AND ${t.dateState} IN ('provisional','confirmed') AND ${t.endsOn} >= ${t.startsOn}))`,
    ),
    check(
      "occurrences_status_ck",
      sql`${t.scheduleStatus} IN ('announced','scheduled','postponed','cancelled') AND (${t.scheduleStatus} != 'scheduled' OR ${t.startsOn} IS NOT NULL)`,
    ),
    check(
      "occurrences_state_ck",
      sql`${t.publicationState} IN ('draft','published','withdrawn') AND ${t.ticketAvailability} IN ('unknown','available','sold_out','closed')`,
    ),
    check(
      "occurrences_location_ck",
      sql`((${t.latitude} IS NULL AND ${t.longitude} IS NULL AND ${t.coordinatePrecision} = 'unknown') OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180 AND ${t.coordinatePrecision} IN ('exact','approximate','locality','region')))`,
    ),
    check(
      "occurrences_publication_ck",
      sql`${t.publicationState} != 'published' OR (${t.occurrenceYear} IS NOT NULL AND ${t.startsOn} IS NOT NULL AND ${t.countryCode} IS NOT NULL AND (${t.venueName} IS NOT NULL OR ${t.locality} IS NOT NULL OR ${t.administrativeArea} IS NOT NULL))`,
    ),
    check(
      "occurrences_capacity_ck",
      sql`${t.capacityEstimate} IS NULL OR ${t.capacityEstimate} > 0`,
    ),
    check(
      "occurrences_price_ck",
      sql`(${t.priceKind} IS NULL AND ${t.priceCurrency} IS NULL AND ${t.priceMinMinor} IS NULL AND ${t.priceMaxMinor} IS NULL AND ${t.priceCoverage} IS NULL AND ${t.priceQualification} IS NULL) OR (${t.priceKind} IS NOT NULL AND ${t.priceKind} = 'free' AND ${t.priceCurrency} IS NULL AND ${t.priceMinMinor} IS NOT NULL AND ${t.priceMaxMinor} IS NOT NULL AND ${t.priceCoverage} IS NOT NULL AND ${t.priceMinMinor} = 0 AND ${t.priceMaxMinor} = 0 AND ${t.priceCoverage} = 'full_programme' AND length(coalesce(${t.priceQualification},'')) <= 500) OR (${t.priceKind} IS NOT NULL AND ${t.priceKind} IN ('exact','from','range') AND ${t.priceCurrency} IS NOT NULL AND length(${t.priceCurrency}) = 3 AND ${t.priceCurrency} GLOB '[A-Z][A-Z][A-Z]' AND ${t.priceMinMinor} IS NOT NULL AND ${t.priceMaxMinor} IS NOT NULL AND typeof(${t.priceMinMinor}) = 'integer' AND typeof(${t.priceMaxMinor}) = 'integer' AND ${t.priceMinMinor} >= 0 AND ((${t.priceKind} = 'range' AND ${t.priceMaxMinor} > ${t.priceMinMinor}) OR (${t.priceKind} IN ('exact','from') AND ${t.priceMaxMinor} = ${t.priceMinMinor})) AND ${t.priceCoverage} IS NOT NULL AND ${t.priceCoverage} IN ('full_programme','day','package') AND length(coalesce(${t.priceQualification},'')) <= 500)`,
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
      "taxonomy_terms_facet_ck",
      sql`${t.facet} IN ('event_type','format','topic','genre','culture')`,
    ),
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
export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    canonicalUrl: text("canonical_url").notNull(),
    kind: text("kind", {
      enum: [
        "website",
        "social",
        "feed",
        "api",
        "submission",
        "manual_reference",
      ],
    }).notNull(),
    authority: text("authority", {
      enum: ["official", "partner", "secondary", "community"],
    }).notNull(),
    platform: text("platform"),
    externalId: text("external_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("sources_url_uq").on(t.canonicalUrl),
    uniqueIndex("sources_platform_id_uq").on(t.platform, t.externalId),
    check(
      "sources_kind_ck",
      sql`${t.kind} IN ('website','social','feed','api','submission','manual_reference')`,
    ),
    check(
      "sources_authority_ck",
      sql`${t.authority} IN ('official','partner','secondary','community')`,
    ),
  ],
);
export const sourceSubjects = sqliteTable(
  "source_subjects",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    eventId: text("event_id").references(() => events.id),
    occurrenceId: text("occurrence_id").references(() => occurrences.id),
  },
  (t) => [
    check(
      "source_subjects_owner_ck",
      sql`(${t.eventId} IS NOT NULL) != (${t.occurrenceId} IS NOT NULL)`,
    ),
    uniqueIndex("source_subjects_event_uq").on(t.sourceId, t.eventId),
    uniqueIndex("source_subjects_occurrence_uq").on(t.sourceId, t.occurrenceId),
  ],
);
export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id),
    occurrenceId: text("occurrence_id").references(() => occurrences.id),
    kind: text("kind", {
      enum: [
        "official_site",
        "instagram",
        "facebook",
        "youtube",
        "tiktok",
        "ticketing",
        "other",
      ],
    }).notNull(),
    url: text("url").notNull(),
    label: text("label"),
    official: integer("official", { mode: "boolean" }).notNull(),
    sourceId: text("source_id").references(() => sources.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check(
      "external_links_owner_ck",
      sql`(${t.eventId} IS NOT NULL) != (${t.occurrenceId} IS NOT NULL)`,
    ),
    check(
      "external_links_kind_ck",
      sql`${t.kind} IN ('official_site','instagram','facebook','youtube','tiktok','ticketing','other')`,
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
  (t) => [
    primaryKey({ columns: [t.scope, t.path] }),
    check("url_aliases_scope_ck", sql`${t.scope} = 'festivals'`),
  ],
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
