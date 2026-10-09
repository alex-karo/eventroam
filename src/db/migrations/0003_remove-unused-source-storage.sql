PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`occurrence_id` text,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`official` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "external_links_owner_ck" CHECK(("__new_external_links"."event_id" IS NOT NULL) != ("__new_external_links"."occurrence_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_external_links`("id", "event_id", "occurrence_id", "kind", "url", "label", "official", "created_at", "updated_at") SELECT "id", "event_id", "occurrence_id", "kind", "url", "label", "official", "created_at", "updated_at" FROM `external_links`;--> statement-breakpoint
DROP TABLE `external_links`;--> statement-breakpoint
ALTER TABLE `__new_external_links` RENAME TO `external_links`;--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_event_uq` ON `external_links` (`event_id`,`kind`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_occurrence_uq` ON `external_links` (`occurrence_id`,`kind`,`url`);--> statement-breakpoint
ALTER TABLE `occurrences` DROP COLUMN `ticket_availability`;--> statement-breakpoint
DROP TABLE `source_subjects`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
