CREATE TABLE `catalog_changes` (
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
CREATE UNIQUE INDEX `catalog_changes_event_operation_uq` ON `catalog_changes` (`operation_key`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_edition_operation_uq` ON `catalog_changes` (`operation_key`,`edition_id`);--> statement-breakpoint
CREATE TABLE `edition_terms` (
	`edition_id` text NOT NULL,
	`term_id` text NOT NULL,
	PRIMARY KEY(`edition_id`, `term_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `editions` (
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
CREATE UNIQUE INDEX `editions_event_key_uq` ON `editions` (`event_id`,`edition_key`);--> statement-breakpoint
CREATE INDEX `editions_event_idx` ON `editions` (`event_id`);--> statement-breakpoint
CREATE INDEX `editions_date_idx` ON `editions` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `editions_country_idx` ON `editions` (`country_code`);--> statement-breakpoint
CREATE INDEX `editions_coordinates_idx` ON `editions` (`latitude`,`longitude`);--> statement-breakpoint
CREATE TABLE `events` (
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
CREATE UNIQUE INDEX `events_slug_uq` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `external_links` (
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
CREATE UNIQUE INDEX `external_links_event_uq` ON `external_links` (`event_id`,`kind`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_edition_uq` ON `external_links` (`edition_id`,`kind`,`url`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
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
CREATE TABLE `operation_receipts` (
	`operation_key` text PRIMARY KEY NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`facet` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_terms_facet_slug_uq` ON `taxonomy_terms` (`facet`,`slug`);--> statement-breakpoint
CREATE TABLE `url_aliases` (
	`scope` text NOT NULL,
	`path` text NOT NULL,
	`event_id` text NOT NULL,
	`edition_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`scope`, `path`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_delete BEFORE DELETE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_update BEFORE UPDATE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_delete BEFORE DELETE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_update BEFORE UPDATE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;
