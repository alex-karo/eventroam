ALTER TABLE `ingestion_runs` DROP COLUMN `input_tokens`;
--> statement-breakpoint
ALTER TABLE `ingestion_runs` DROP COLUMN `output_tokens`;
--> statement-breakpoint
ALTER TABLE `ingestion_runs` DROP COLUMN `model_cost_usd`;
--> statement-breakpoint
ALTER TABLE `ingestion_runs` DROP COLUMN `search_cost_estimate_usd`;
--> statement-breakpoint
ALTER TABLE `ingestion_runs` DROP COLUMN `usage_complete`;
