-- Rename catalog storage without rewriting audit, receipt or run JSON.
DROP TRIGGER url_aliases_occurrence_owner_insert;
--> statement-breakpoint
ALTER TABLE occurrences RENAME TO editions;
--> statement-breakpoint
ALTER TABLE occurrence_terms RENAME TO edition_terms;
--> statement-breakpoint
ALTER TABLE editions RENAME COLUMN occurrence_key TO edition_key;
--> statement-breakpoint
ALTER TABLE editions RENAME COLUMN occurrence_year TO edition_year;
--> statement-breakpoint
ALTER TABLE edition_terms RENAME COLUMN occurrence_id TO edition_id;
--> statement-breakpoint
ALTER TABLE external_links RENAME COLUMN occurrence_id TO edition_id;
--> statement-breakpoint
ALTER TABLE url_aliases RENAME COLUMN occurrence_id TO edition_id;
--> statement-breakpoint
ALTER TABLE catalog_changes RENAME COLUMN occurrence_id TO edition_id;
--> statement-breakpoint
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
	CONSTRAINT "editions_dates_ck" CHECK((("__new_editions"."starts_on" IS NULL AND "__new_editions"."ends_on" IS NULL) OR ("__new_editions"."starts_on" IS NOT NULL AND "__new_editions"."ends_on" IS NOT NULL AND "__new_editions"."ends_on" >= "__new_editions"."starts_on"))),
	CONSTRAINT "editions_location_ck" CHECK((("__new_editions"."latitude" IS NULL AND "__new_editions"."longitude" IS NULL) OR ("__new_editions"."latitude" IS NOT NULL AND "__new_editions"."longitude" IS NOT NULL AND "__new_editions"."latitude" BETWEEN -90 AND 90 AND "__new_editions"."longitude" BETWEEN -180 AND 180))),
	CONSTRAINT "editions_capacity_ck" CHECK("__new_editions"."capacity_estimate" IS NULL OR "__new_editions"."capacity_estimate" > 0),
	CONSTRAINT "editions_version_ck" CHECK("__new_editions"."version" > 0),
	CONSTRAINT "editions_price_details_ck" CHECK(json_valid("__new_editions"."price_details") AND json_type("__new_editions"."price_details") = 'array')
);
--> statement-breakpoint
INSERT INTO __new_editions(`id`,`event_id`,`edition_key`,`display_name`,`edition_year`,`starts_on`,`ends_on`,`date_state`,`schedule_status`,`capacity_estimate`,`publication_state`,`venue_name`,`venue_address`,`locality`,`administrative_area`,`country_code`,`latitude`,`longitude`,`coordinate_precision`,`time_zone`,`price_kind`,`price_currency`,`price_min_minor`,`price_max_minor`,`price_coverage`,`price_qualification`,`price_details`,`version`,`created_at`,`updated_at`) SELECT `id`,`event_id`,`edition_key`,`display_name`,`edition_year`,`starts_on`,`ends_on`,`date_state`,`schedule_status`,`capacity_estimate`,`publication_state`,`venue_name`,`venue_address`,`locality`,`administrative_area`,`country_code`,`latitude`,`longitude`,`coordinate_precision`,`time_zone`,`price_kind`,`price_currency`,`price_min_minor`,`price_max_minor`,`price_coverage`,`price_qualification`,`price_details`,`version`,`created_at`,`updated_at` FROM editions;
--> statement-breakpoint
DROP TABLE editions;
--> statement-breakpoint
ALTER TABLE __new_editions RENAME TO editions;
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_event_key_uq` ON `editions` (`event_id`,`edition_key`);
--> statement-breakpoint
CREATE INDEX `editions_event_idx` ON `editions` (`event_id`);
--> statement-breakpoint
CREATE INDEX `editions_date_idx` ON `editions` (`starts_on`,`ends_on`);
--> statement-breakpoint
CREATE INDEX `editions_country_idx` ON `editions` (`country_code`);
--> statement-breakpoint
CREATE INDEX `editions_coordinates_idx` ON `editions` (`latitude`,`longitude`);
--> statement-breakpoint
DROP INDEX `external_links_occurrence_uq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_edition_uq` ON `external_links` (`edition_id`,`kind`,`url`);
--> statement-breakpoint
DROP INDEX `catalog_changes_occurrence_operation_uq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_edition_operation_uq` ON `catalog_changes` (`operation_key`,`edition_id`);
--> statement-breakpoint
CREATE TRIGGER url_aliases_edition_owner_insert BEFORE INSERT ON url_aliases WHEN NEW.edition_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'alias edition must belong to event') WHERE (SELECT event_id FROM editions WHERE id=NEW.edition_id) != NEW.event_id; END;
