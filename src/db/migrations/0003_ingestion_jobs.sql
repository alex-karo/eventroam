CREATE TABLE `ingestion_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_id` text NOT NULL,
  `position` integer NOT NULL,
  `event_id` text NOT NULL,
  `scope` text NOT NULL,
  `dry_run` integer NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_jobs_batch_position_uq` ON `ingestion_jobs` (`batch_id`, `position`);
--> statement-breakpoint
CREATE INDEX `ingestion_jobs_queue_idx` ON `ingestion_jobs` (`status`, `created_at`, `batch_id`, `position`);
--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `job_id` text REFERENCES `ingestion_jobs`(`id`);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_job_idx` ON `ingestion_runs` (`job_id`);
