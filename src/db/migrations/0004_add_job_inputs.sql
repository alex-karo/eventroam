CREATE TABLE `__new_ingestion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`add_input` text,
	`event_id` text,
	`scope` text,
	`dry_run` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ingestion_jobs`("id", "batch_id", "position", "add_input", "event_id", "scope", "dry_run", "status", "created_at") SELECT "id", "batch_id", "position", NULL, "event_id", "scope", "dry_run", "status", "created_at" FROM `ingestion_jobs`;--> statement-breakpoint
DROP TABLE `ingestion_jobs`;--> statement-breakpoint
ALTER TABLE `__new_ingestion_jobs` RENAME TO `ingestion_jobs`;--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_jobs_batch_position_uq` ON `ingestion_jobs` (`batch_id`,`position`);--> statement-breakpoint
CREATE INDEX `ingestion_jobs_queue_idx` ON `ingestion_jobs` (`status`,`created_at`,`batch_id`,`position`);