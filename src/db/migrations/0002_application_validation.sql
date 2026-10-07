PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER taxonomy_parent_insert;--> statement-breakpoint
DROP TRIGGER taxonomy_parent_update;--> statement-breakpoint
DROP TRIGGER occurrence_term_facet_insert;--> statement-breakpoint
DROP TRIGGER url_aliases_occurrence_owner_insert;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`canonical_name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`home_scope` text,
	`publication_state` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "events_version_ck" CHECK("__new_events"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "slug", "canonical_name", "aliases", "summary", "home_scope", "publication_state", "version", "created_at", "updated_at") SELECT "id", "slug", "canonical_name", "aliases", "summary", "home_scope", "publication_state", "version", "created_at", "updated_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_uq` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`occurrence_id` text,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`official` integer NOT NULL,
	`source_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "external_links_owner_ck" CHECK(("__new_external_links"."event_id" IS NOT NULL) != ("__new_external_links"."occurrence_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_external_links`("id", "event_id", "occurrence_id", "kind", "url", "label", "official", "source_id", "created_at", "updated_at") SELECT "id", "event_id", "occurrence_id", "kind", "url", "label", "official", "source_id", "created_at", "updated_at" FROM `external_links`;--> statement-breakpoint
DROP TABLE `external_links`;--> statement-breakpoint
ALTER TABLE `__new_external_links` RENAME TO `external_links`;--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_event_uq` ON `external_links` (`event_id`,`kind`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_occurrence_uq` ON `external_links` (`occurrence_id`,`kind`,`url`);--> statement-breakpoint
CREATE TABLE `__new_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`display_name` text,
	`occurrence_year` integer,
	`starts_on` text,
	`ends_on` text,
	`date_state` text DEFAULT 'unknown' NOT NULL,
	`schedule_status` text DEFAULT 'announced' NOT NULL,
	`ticket_availability` text DEFAULT 'unknown' NOT NULL,
	`capacity_estimate` integer,
	`publication_state` text DEFAULT 'draft' NOT NULL,
	`venue_name` text,
	`venue_address` text,
	`locality` text,
	`administrative_area` text,
	`country_code` text,
	`latitude` real,
	`longitude` real,
	`coordinate_precision` text DEFAULT 'unknown' NOT NULL,
	`time_zone` text,
	`price_kind` text,
	`price_currency` text,
	`price_min_minor` integer,
	`price_max_minor` integer,
	`price_coverage` text,
	`price_qualification` text,
	`price_details` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "occurrences_dates_ck" CHECK((("__new_occurrences"."starts_on" IS NULL AND "__new_occurrences"."ends_on" IS NULL) OR ("__new_occurrences"."starts_on" IS NOT NULL AND "__new_occurrences"."ends_on" IS NOT NULL AND "__new_occurrences"."ends_on" >= "__new_occurrences"."starts_on"))),
	CONSTRAINT "occurrences_location_ck" CHECK((("__new_occurrences"."latitude" IS NULL AND "__new_occurrences"."longitude" IS NULL) OR ("__new_occurrences"."latitude" IS NOT NULL AND "__new_occurrences"."longitude" IS NOT NULL AND "__new_occurrences"."latitude" BETWEEN -90 AND 90 AND "__new_occurrences"."longitude" BETWEEN -180 AND 180))),
	CONSTRAINT "occurrences_capacity_ck" CHECK("__new_occurrences"."capacity_estimate" IS NULL OR "__new_occurrences"."capacity_estimate" > 0),
	CONSTRAINT "occurrences_version_ck" CHECK("__new_occurrences"."version" > 0),
	CONSTRAINT "occurrences_price_details_ck" CHECK(json_valid("__new_occurrences"."price_details") AND json_type("__new_occurrences"."price_details") = 'array')
);
--> statement-breakpoint
INSERT INTO `__new_occurrences`("id", "event_id", "occurrence_key", "display_name", "occurrence_year", "starts_on", "ends_on", "date_state", "schedule_status", "ticket_availability", "capacity_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", "price_details", "version", "created_at", "updated_at") SELECT "id", "event_id", "occurrence_key", "display_name", "occurrence_year", "starts_on", "ends_on", "date_state", "schedule_status", "ticket_availability", "capacity_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", "price_details", "version", "created_at", "updated_at" FROM `occurrences`;--> statement-breakpoint
DROP TABLE `occurrences`;--> statement-breakpoint
ALTER TABLE `__new_occurrences` RENAME TO `occurrences`;--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_event_key_uq` ON `occurrences` (`event_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `occurrences_event_idx` ON `occurrences` (`event_id`);--> statement-breakpoint
CREATE INDEX `occurrences_date_idx` ON `occurrences` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `occurrences_country_idx` ON `occurrences` (`country_code`);--> statement-breakpoint
CREATE INDEX `occurrences_coordinates_idx` ON `occurrences` (`latitude`,`longitude`);--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`kind` text NOT NULL,
	`authority` text NOT NULL,
	`platform` text,
	`external_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sources`("id", "canonical_url", "kind", "authority", "platform", "external_id", "created_at", "updated_at", "version") SELECT "id", "canonical_url", "kind", "authority", "platform", "external_id", "created_at", "updated_at", "version" FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
CREATE UNIQUE INDEX `sources_url_uq` ON `sources` (`canonical_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_platform_id_uq` ON `sources` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `__new_taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`facet` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "taxonomy_terms_parent_ck" CHECK("__new_taxonomy_terms"."parent_id" IS NULL OR "__new_taxonomy_terms"."parent_id" != "__new_taxonomy_terms"."id")
);
--> statement-breakpoint
INSERT INTO `__new_taxonomy_terms`("id", "facet", "slug", "name", "parent_id") SELECT "id", "facet", "slug", "name", "parent_id" FROM `taxonomy_terms`;--> statement-breakpoint
DROP TABLE `taxonomy_terms`;--> statement-breakpoint
ALTER TABLE `__new_taxonomy_terms` RENAME TO `taxonomy_terms`;--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_terms_facet_slug_uq` ON `taxonomy_terms` (`facet`,`slug`);--> statement-breakpoint
CREATE TABLE `__new_url_aliases` (
	`scope` text NOT NULL,
	`path` text NOT NULL,
	`event_id` text NOT NULL,
	`occurrence_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`scope`, `path`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_url_aliases`("scope", "path", "event_id", "occurrence_id", "created_at") SELECT "scope", "path", "event_id", "occurrence_id", "created_at" FROM `url_aliases`;--> statement-breakpoint
DROP TABLE `url_aliases`;--> statement-breakpoint
ALTER TABLE `__new_url_aliases` RENAME TO `url_aliases`;
--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_update BEFORE UPDATE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;

--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_delete BEFORE DELETE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;

--> statement-breakpoint
CREATE TRIGGER url_aliases_occurrence_owner_insert BEFORE INSERT ON url_aliases WHEN NEW.occurrence_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'alias occurrence must belong to event') WHERE (SELECT event_id FROM occurrences WHERE id=NEW.occurrence_id) != NEW.event_id; END;

--> statement-breakpoint
CREATE TRIGGER taxonomy_parent_cycle_update BEFORE UPDATE OF parent_id ON taxonomy_terms WHEN NEW.parent_id IS NOT NULL BEGIN WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_id UNION ALL SELECT t.parent_id FROM taxonomy_terms t JOIN ancestors a ON t.id=a.id WHERE t.parent_id IS NOT NULL) SELECT RAISE(ABORT, 'taxonomy parent cycle') WHERE EXISTS (SELECT 1 FROM ancestors WHERE id=NEW.id); END;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
