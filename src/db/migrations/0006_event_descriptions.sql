ALTER TABLE `events` RENAME COLUMN "summary" TO "description";--> statement-breakpoint
ALTER TABLE `events` ADD `short_description` text;