DROP TRIGGER taxonomy_parent_cycle_update;--> statement-breakpoint
DROP TRIGGER url_aliases_edition_owner_insert;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_catalog_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`edition_id` text,
	`subject_version` integer NOT NULL,
	`changed_fields` text NOT NULL,
	`operation_key` text NOT NULL,
	`actor` text NOT NULL,
	`initiated_by` text,
	`changed_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_catalog_changes`("id", "event_id", "edition_id", "subject_version", "changed_fields", "operation_key", "actor", "initiated_by", "changed_at", "note") SELECT "id", "event_id", "edition_id", "subject_version", "changed_fields", "operation_key", "actor", "initiated_by", "changed_at", "note" FROM `catalog_changes`;--> statement-breakpoint
DROP TABLE `catalog_changes`;--> statement-breakpoint
ALTER TABLE `__new_catalog_changes` RENAME TO `catalog_changes`;--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_event_operation_uq` ON `catalog_changes` (`operation_key`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_edition_operation_uq` ON `catalog_changes` (`operation_key`,`edition_id`);--> statement-breakpoint
CREATE TABLE `__new_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`edition_key` text NOT NULL,
	`display_name` text,
	`edition_year` integer,
	`starts_on` text,
	`ends_on` text,
	`date_state` text DEFAULT 'unknown' NOT NULL,
	`schedule_status` text DEFAULT 'announced' NOT NULL,
	`size_estimate` integer,
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
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_editions`("id", "event_id", "edition_key", "display_name", "edition_year", "starts_on", "ends_on", "date_state", "schedule_status", "size_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", "price_details", "version", "created_at", "updated_at") SELECT "id", "event_id", "edition_key", "display_name", "edition_year", "starts_on", "ends_on", "date_state", "schedule_status", "size_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", "price_details", "version", "created_at", "updated_at" FROM `editions`;--> statement-breakpoint
DROP TABLE `editions`;--> statement-breakpoint
ALTER TABLE `__new_editions` RENAME TO `editions`;--> statement-breakpoint
CREATE UNIQUE INDEX `editions_event_key_uq` ON `editions` (`event_id`,`edition_key`);--> statement-breakpoint
CREATE INDEX `editions_event_idx` ON `editions` (`event_id`);--> statement-breakpoint
CREATE INDEX `editions_date_idx` ON `editions` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `editions_country_idx` ON `editions` (`country_code`);--> statement-breakpoint
CREATE INDEX `editions_coordinates_idx` ON `editions` (`latitude`,`longitude`);--> statement-breakpoint
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
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "slug", "canonical_name", "aliases", "summary", "home_scope", "publication_state", "version", "created_at", "updated_at") SELECT "id", "slug", "canonical_name", "aliases", "summary", "home_scope", "publication_state", "version", "created_at", "updated_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_uq` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`edition_id` text,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`official` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_external_links`("id", "event_id", "edition_id", "kind", "url", "label", "official", "created_at", "updated_at") SELECT "id", "event_id", "edition_id", "kind", "url", "label", "official", "created_at", "updated_at" FROM `external_links`;--> statement-breakpoint
DROP TABLE `external_links`;--> statement-breakpoint
ALTER TABLE `__new_external_links` RENAME TO `external_links`;--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_event_uq` ON `external_links` (`event_id`,`kind`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_edition_uq` ON `external_links` (`edition_id`,`kind`,`url`);--> statement-breakpoint
CREATE TABLE `__new_ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`input_json` text NOT NULL,
	`report_json` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`model_cost_usd` real,
	`search_cost_estimate_usd` real,
	`duration_ms` integer,
	`usage_complete` integer
);
--> statement-breakpoint
INSERT INTO `__new_ingestion_runs`("id", "event_id", "mode", "status", "started_at", "finished_at", "input_json", "report_json", "input_tokens", "output_tokens", "model_cost_usd", "search_cost_estimate_usd", "duration_ms", "usage_complete") SELECT "id", "event_id", "mode", "status", "started_at", "finished_at", "input_json", "report_json", "input_tokens", "output_tokens", "model_cost_usd", "search_cost_estimate_usd", "duration_ms", "usage_complete" FROM `ingestion_runs`;--> statement-breakpoint
DROP TABLE `ingestion_runs`;--> statement-breakpoint
ALTER TABLE `__new_ingestion_runs` RENAME TO `ingestion_runs`;--> statement-breakpoint
CREATE TABLE `__new_taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`facet` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_taxonomy_terms`("id", "facet", "slug", "name", "parent_id") SELECT "id", "facet", "slug", "name", "parent_id" FROM `taxonomy_terms`;--> statement-breakpoint
DROP TABLE `taxonomy_terms`;--> statement-breakpoint
ALTER TABLE `__new_taxonomy_terms` RENAME TO `taxonomy_terms`;--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_terms_facet_slug_uq` ON `taxonomy_terms` (`facet`,`slug`);
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_update BEFORE UPDATE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_delete BEFORE DELETE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
