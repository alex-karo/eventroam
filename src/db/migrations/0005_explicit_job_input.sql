ALTER TABLE `ingestion_jobs` RENAME COLUMN `add_input` TO `input`;
--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ADD COLUMN `mode` text;
--> statement-breakpoint
UPDATE `ingestion_jobs`
SET `mode` = CASE WHEN `input` IS NULL THEN 'refresh' ELSE 'add' END,
    `input` = CASE
      WHEN `input` IS NULL THEN json_object('eventId', `event_id`, 'scope', `scope`)
      WHEN `event_id` IS NULL AND `scope` IS NULL THEN json_quote(`input`)
      ELSE json_object('addInput', `input`, 'eventId', `event_id`, 'scope', `scope`)
    END;
--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ALTER COLUMN `mode` SET NOT NULL;
--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ALTER COLUMN `input` SET NOT NULL;
--> statement-breakpoint
ALTER TABLE `ingestion_jobs` DROP COLUMN `event_id`;
--> statement-breakpoint
ALTER TABLE `ingestion_jobs` DROP COLUMN `scope`;
