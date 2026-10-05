PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER url_aliases_occurrence_owner_insert;--> statement-breakpoint
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
	CONSTRAINT "occurrences_dates_ck" CHECK((("__new_occurrences"."starts_on" IS NULL AND "__new_occurrences"."ends_on" IS NULL AND "__new_occurrences"."date_state" = 'unknown') OR ("__new_occurrences"."starts_on" IS NOT NULL AND "__new_occurrences"."ends_on" IS NOT NULL AND "__new_occurrences"."date_state" IN ('provisional','confirmed') AND "__new_occurrences"."ends_on" >= "__new_occurrences"."starts_on"))),
	CONSTRAINT "occurrences_status_ck" CHECK("__new_occurrences"."schedule_status" IN ('announced','scheduled','postponed','cancelled') AND ("__new_occurrences"."schedule_status" != 'scheduled' OR "__new_occurrences"."starts_on" IS NOT NULL)),
	CONSTRAINT "occurrences_state_ck" CHECK("__new_occurrences"."publication_state" IN ('draft','published','withdrawn') AND "__new_occurrences"."ticket_availability" IN ('unknown','available','sold_out','closed')),
	CONSTRAINT "occurrences_location_ck" CHECK((("__new_occurrences"."latitude" IS NULL AND "__new_occurrences"."longitude" IS NULL AND "__new_occurrences"."coordinate_precision" = 'unknown') OR ("__new_occurrences"."latitude" IS NOT NULL AND "__new_occurrences"."longitude" IS NOT NULL AND "__new_occurrences"."latitude" BETWEEN -90 AND 90 AND "__new_occurrences"."longitude" BETWEEN -180 AND 180 AND "__new_occurrences"."coordinate_precision" IN ('exact','approximate','locality','region')))),
	CONSTRAINT "occurrences_publication_ck" CHECK("__new_occurrences"."publication_state" != 'published' OR ("__new_occurrences"."occurrence_year" IS NOT NULL AND "__new_occurrences"."starts_on" IS NOT NULL AND "__new_occurrences"."country_code" IS NOT NULL AND ("__new_occurrences"."venue_name" IS NOT NULL OR "__new_occurrences"."locality" IS NOT NULL OR "__new_occurrences"."administrative_area" IS NOT NULL))),
	CONSTRAINT "occurrences_capacity_ck" CHECK("__new_occurrences"."capacity_estimate" IS NULL OR "__new_occurrences"."capacity_estimate" > 0),
	CONSTRAINT "occurrences_price_ck" CHECK(("__new_occurrences"."price_kind" IS NULL AND "__new_occurrences"."price_currency" IS NULL AND "__new_occurrences"."price_min_minor" IS NULL AND "__new_occurrences"."price_max_minor" IS NULL AND "__new_occurrences"."price_coverage" IS NULL AND "__new_occurrences"."price_qualification" IS NULL) OR ("__new_occurrences"."price_kind" IS NOT NULL AND "__new_occurrences"."price_kind" = 'free' AND "__new_occurrences"."price_currency" IS NULL AND "__new_occurrences"."price_min_minor" IS NOT NULL AND "__new_occurrences"."price_max_minor" IS NOT NULL AND "__new_occurrences"."price_coverage" IS NOT NULL AND "__new_occurrences"."price_min_minor" = 0 AND "__new_occurrences"."price_max_minor" = 0 AND "__new_occurrences"."price_coverage" = 'full_programme' AND length(coalesce("__new_occurrences"."price_qualification",'')) <= 500) OR ("__new_occurrences"."price_kind" IS NOT NULL AND "__new_occurrences"."price_kind" IN ('exact','from','range') AND "__new_occurrences"."price_currency" IS NOT NULL AND length("__new_occurrences"."price_currency") = 3 AND "__new_occurrences"."price_currency" GLOB '[A-Z][A-Z][A-Z]' AND "__new_occurrences"."price_min_minor" IS NOT NULL AND "__new_occurrences"."price_max_minor" IS NOT NULL AND typeof("__new_occurrences"."price_min_minor") = 'integer' AND typeof("__new_occurrences"."price_max_minor") = 'integer' AND "__new_occurrences"."price_min_minor" >= 0 AND (("__new_occurrences"."price_kind" = 'range' AND "__new_occurrences"."price_max_minor" > "__new_occurrences"."price_min_minor") OR ("__new_occurrences"."price_kind" IN ('exact','from') AND "__new_occurrences"."price_max_minor" = "__new_occurrences"."price_min_minor")) AND "__new_occurrences"."price_coverage" IS NOT NULL AND "__new_occurrences"."price_coverage" IN ('full_programme','day','package') AND length(coalesce("__new_occurrences"."price_qualification",'')) <= 500)),
	CONSTRAINT "occurrences_version_ck" CHECK("__new_occurrences"."version" > 0),
	CONSTRAINT "occurrences_price_details_ck" CHECK(json_valid("__new_occurrences"."price_details") AND json_type("__new_occurrences"."price_details") = 'array')
);
--> statement-breakpoint
INSERT INTO `__new_occurrences`("id", "event_id", "occurrence_key", "display_name", "occurrence_year", "starts_on", "ends_on", "date_state", "schedule_status", "ticket_availability", "capacity_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", "price_details", "version", "created_at", "updated_at") SELECT "id", "event_id", "occurrence_key", "display_name", "occurrence_year", "starts_on", "ends_on", "date_state", "schedule_status", "ticket_availability", "capacity_estimate", "publication_state", "venue_name", "venue_address", "locality", "administrative_area", "country_code", "latitude", "longitude", "coordinate_precision", "time_zone", "price_kind", "price_currency", "price_min_minor", "price_max_minor", "price_coverage", "price_qualification", '[]', "version", "created_at", "updated_at" FROM `occurrences`;--> statement-breakpoint
DROP TABLE `occurrences`;--> statement-breakpoint
ALTER TABLE `__new_occurrences` RENAME TO `occurrences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_event_key_uq` ON `occurrences` (`event_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `occurrences_event_idx` ON `occurrences` (`event_id`);--> statement-breakpoint
CREATE INDEX `occurrences_date_idx` ON `occurrences` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `occurrences_country_idx` ON `occurrences` (`country_code`);--> statement-breakpoint
CREATE INDEX `occurrences_coordinates_idx` ON `occurrences` (`latitude`,`longitude`);--> statement-breakpoint
CREATE TRIGGER url_aliases_occurrence_owner_insert BEFORE INSERT ON url_aliases WHEN NEW.occurrence_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'alias occurrence must belong to event') WHERE (SELECT event_id FROM occurrences WHERE id=NEW.occurrence_id) != NEW.event_id; END;
