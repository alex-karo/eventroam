CREATE TABLE `catalog_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`occurrence_id` text,
	`subject_version` integer NOT NULL,
	`changed_fields` text NOT NULL,
	`operation_key` text NOT NULL,
	`ingestion_run_id` text,
	`actor` text NOT NULL,
	`initiated_by` text,
	`changed_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "catalog_changes_subject_ck" CHECK(("catalog_changes"."event_id" IS NOT NULL) != ("catalog_changes"."occurrence_id" IS NOT NULL)),
	CONSTRAINT "catalog_changes_version_ck" CHECK("catalog_changes"."subject_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_event_operation_uq` ON `catalog_changes` (`operation_key`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_changes_occurrence_operation_uq` ON `catalog_changes` (`operation_key`,`occurrence_id`);--> statement-breakpoint
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
	`updated_at` text NOT NULL,
	CONSTRAINT "events_version_ck" CHECK("events"."version" > 0),
	CONSTRAINT "events_state_ck" CHECK("events"."publication_state" IN ('draft','published','withdrawn')),
	CONSTRAINT "events_scope_ck" CHECK("events"."home_scope" IS NULL OR "events"."home_scope" = 'festivals'),
	CONSTRAINT "events_published_scope_ck" CHECK("events"."publication_state" != 'published' OR "events"."home_scope" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_uq` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `external_links` (
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
	CONSTRAINT "external_links_owner_ck" CHECK(("external_links"."event_id" IS NOT NULL) != ("external_links"."occurrence_id" IS NOT NULL)),
	CONSTRAINT "external_links_kind_ck" CHECK("external_links"."kind" IN ('official_site','instagram','facebook','youtube','tiktok','ticketing','other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_event_uq` ON `external_links` (`event_id`,`kind`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_occurrence_uq` ON `external_links` (`occurrence_id`,`kind`,`url`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`initiated_by` text NOT NULL,
	`adapter_versions` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`summary` text,
	`results` text,
	CONSTRAINT "ingestion_runs_mode_ck" CHECK("ingestion_runs"."mode" IN ('dry_run','apply')),
	CONSTRAINT "ingestion_runs_status_ck" CHECK("ingestion_runs"."status" IN ('running','succeeded','partially_failed','failed'))
);
--> statement-breakpoint
CREATE TABLE `occurrence_terms` (
	`occurrence_id` text NOT NULL,
	`term_id` text NOT NULL,
	PRIMARY KEY(`occurrence_id`, `term_id`),
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
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
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "occurrences_dates_ck" CHECK((("occurrences"."starts_on" IS NULL AND "occurrences"."ends_on" IS NULL AND "occurrences"."date_state" = 'unknown') OR ("occurrences"."starts_on" IS NOT NULL AND "occurrences"."ends_on" IS NOT NULL AND "occurrences"."date_state" IN ('provisional','confirmed') AND "occurrences"."ends_on" >= "occurrences"."starts_on"))),
	CONSTRAINT "occurrences_status_ck" CHECK("occurrences"."schedule_status" IN ('announced','scheduled','postponed','cancelled') AND ("occurrences"."schedule_status" != 'scheduled' OR "occurrences"."starts_on" IS NOT NULL)),
	CONSTRAINT "occurrences_state_ck" CHECK("occurrences"."publication_state" IN ('draft','published','withdrawn') AND "occurrences"."ticket_availability" IN ('unknown','available','sold_out')),
	CONSTRAINT "occurrences_location_ck" CHECK((("occurrences"."latitude" IS NULL AND "occurrences"."longitude" IS NULL AND "occurrences"."coordinate_precision" = 'unknown') OR ("occurrences"."latitude" IS NOT NULL AND "occurrences"."longitude" IS NOT NULL AND "occurrences"."latitude" BETWEEN -90 AND 90 AND "occurrences"."longitude" BETWEEN -180 AND 180 AND "occurrences"."coordinate_precision" IN ('exact','approximate','locality','region')))),
	CONSTRAINT "occurrences_publication_ck" CHECK("occurrences"."publication_state" != 'published' OR ("occurrences"."occurrence_year" IS NOT NULL AND "occurrences"."starts_on" IS NOT NULL AND "occurrences"."country_code" IS NOT NULL AND ("occurrences"."venue_name" IS NOT NULL OR "occurrences"."locality" IS NOT NULL OR "occurrences"."administrative_area" IS NOT NULL))),
	CONSTRAINT "occurrences_capacity_ck" CHECK("occurrences"."capacity_estimate" IS NULL OR "occurrences"."capacity_estimate" > 0),
	CONSTRAINT "occurrences_price_ck" CHECK(("occurrences"."price_kind" IS NULL AND "occurrences"."price_currency" IS NULL AND "occurrences"."price_min_minor" IS NULL AND "occurrences"."price_max_minor" IS NULL AND "occurrences"."price_coverage" IS NULL AND "occurrences"."price_qualification" IS NULL) OR ("occurrences"."price_kind" IS NOT NULL AND "occurrences"."price_kind" = 'free' AND "occurrences"."price_currency" IS NULL AND "occurrences"."price_min_minor" IS NOT NULL AND "occurrences"."price_max_minor" IS NOT NULL AND "occurrences"."price_coverage" IS NOT NULL AND "occurrences"."price_min_minor" = 0 AND "occurrences"."price_max_minor" = 0 AND "occurrences"."price_coverage" = 'full_programme' AND length(coalesce("occurrences"."price_qualification",'')) <= 500) OR ("occurrences"."price_kind" IS NOT NULL AND "occurrences"."price_kind" IN ('exact','from','range') AND "occurrences"."price_currency" IS NOT NULL AND length("occurrences"."price_currency") = 3 AND "occurrences"."price_currency" GLOB '[A-Z][A-Z][A-Z]' AND "occurrences"."price_min_minor" IS NOT NULL AND "occurrences"."price_max_minor" IS NOT NULL AND typeof("occurrences"."price_min_minor") = 'integer' AND typeof("occurrences"."price_max_minor") = 'integer' AND "occurrences"."price_min_minor" >= 0 AND (("occurrences"."price_kind" = 'range' AND "occurrences"."price_max_minor" > "occurrences"."price_min_minor") OR ("occurrences"."price_kind" IN ('exact','from') AND "occurrences"."price_max_minor" = "occurrences"."price_min_minor")) AND "occurrences"."price_coverage" IS NOT NULL AND "occurrences"."price_coverage" IN ('full_programme','day','package') AND length(coalesce("occurrences"."price_qualification",'')) <= 500)),
	CONSTRAINT "occurrences_version_ck" CHECK("occurrences"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_event_key_uq` ON `occurrences` (`event_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `occurrences_event_idx` ON `occurrences` (`event_id`);--> statement-breakpoint
CREATE INDEX `occurrences_date_idx` ON `occurrences` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `occurrences_country_idx` ON `occurrences` (`country_code`);--> statement-breakpoint
CREATE INDEX `occurrences_coordinates_idx` ON `occurrences` (`latitude`,`longitude`);--> statement-breakpoint
CREATE TABLE `operation_receipts` (
	`operation_key` text PRIMARY KEY NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_subjects` (
	`source_id` text NOT NULL,
	`event_id` text,
	`occurrence_id` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "source_subjects_owner_ck" CHECK(("source_subjects"."event_id" IS NOT NULL) != ("source_subjects"."occurrence_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_subjects_event_uq` ON `source_subjects` (`source_id`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_subjects_occurrence_uq` ON `source_subjects` (`source_id`,`occurrence_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`kind` text NOT NULL,
	`authority` text NOT NULL,
	`platform` text,
	`external_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sources_kind_ck" CHECK("sources"."kind" IN ('website','social','feed','api','submission','manual_reference')),
	CONSTRAINT "sources_authority_ck" CHECK("sources"."authority" IN ('official','partner','secondary','community'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_url_uq` ON `sources` (`canonical_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_platform_id_uq` ON `sources` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`facet` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "taxonomy_terms_facet_ck" CHECK("taxonomy_terms"."facet" IN ('event_type','format','topic','genre','culture')),
	CONSTRAINT "taxonomy_terms_parent_ck" CHECK("taxonomy_terms"."parent_id" IS NULL OR "taxonomy_terms"."parent_id" != "taxonomy_terms"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_terms_facet_slug_uq` ON `taxonomy_terms` (`facet`,`slug`);--> statement-breakpoint
CREATE TABLE `url_aliases` (
	`scope` text NOT NULL,
	`path` text NOT NULL,
	`event_id` text NOT NULL,
	`occurrence_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`scope`, `path`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "url_aliases_scope_ck" CHECK("url_aliases"."scope" = 'festivals')
);
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_update BEFORE UPDATE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_changes_immutable_delete BEFORE DELETE ON catalog_changes BEGIN SELECT RAISE(ABORT, 'catalog_changes are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_update BEFORE UPDATE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER url_aliases_immutable_delete BEFORE DELETE ON url_aliases BEGIN SELECT RAISE(ABORT, 'public URL aliases are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER taxonomy_parent_insert BEFORE INSERT ON taxonomy_terms WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'taxonomy parent must be in same facet') WHERE (SELECT facet FROM taxonomy_terms WHERE id=NEW.parent_id) != NEW.facet; END;
--> statement-breakpoint
CREATE TRIGGER taxonomy_parent_update BEFORE UPDATE OF parent_id,facet ON taxonomy_terms WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'taxonomy parent must be in same facet') WHERE (SELECT facet FROM taxonomy_terms WHERE id=NEW.parent_id) != NEW.facet; END;
--> statement-breakpoint
CREATE TRIGGER occurrence_term_facet_insert BEFORE INSERT ON occurrence_terms WHEN (SELECT facet FROM taxonomy_terms WHERE id=NEW.term_id) IN ('event_type','format') BEGIN SELECT RAISE(ABORT, 'single-valued taxonomy facet already assigned') WHERE EXISTS (SELECT 1 FROM occurrence_terms ot JOIN taxonomy_terms t ON t.id=ot.term_id WHERE ot.occurrence_id=NEW.occurrence_id AND t.facet=(SELECT facet FROM taxonomy_terms WHERE id=NEW.term_id)); END;
--> statement-breakpoint
CREATE TRIGGER url_aliases_occurrence_owner_insert BEFORE INSERT ON url_aliases WHEN NEW.occurrence_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'alias occurrence must belong to event') WHERE (SELECT event_id FROM occurrences WHERE id=NEW.occurrence_id) != NEW.event_id; END;
--> statement-breakpoint
CREATE TRIGGER taxonomy_parent_cycle_update BEFORE UPDATE OF parent_id ON taxonomy_terms WHEN NEW.parent_id IS NOT NULL BEGIN WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_id UNION ALL SELECT t.parent_id FROM taxonomy_terms t JOIN ancestors a ON t.id=a.id WHERE t.parent_id IS NOT NULL) SELECT RAISE(ABORT, 'taxonomy parent cycle') WHERE EXISTS (SELECT 1 FROM ancestors WHERE id=NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER ingestion_runs_completed_immutable BEFORE UPDATE ON ingestion_runs WHEN OLD.status != 'running' BEGIN SELECT RAISE(ABORT, 'completed runs are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER ingestion_runs_completed_no_delete BEFORE DELETE ON ingestion_runs WHEN OLD.status != 'running' BEGIN SELECT RAISE(ABORT, 'completed runs are immutable'); END;
