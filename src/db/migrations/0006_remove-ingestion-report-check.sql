PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ingestion_runs` (
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
	`usage_complete` integer,
	CONSTRAINT "ingestion_runs_mode_ck" CHECK(length(trim("__new_ingestion_runs"."mode")) > 0),
	CONSTRAINT "ingestion_runs_status_ck" CHECK("__new_ingestion_runs"."status" IN ('running', 'completed', 'failed')),
	CONSTRAINT "ingestion_runs_input_ck" CHECK(CASE WHEN json_valid("__new_ingestion_runs"."input_json") THEN json_type("__new_ingestion_runs"."input_json") IS 'object' AND json_extract("__new_ingestion_runs"."input_json", '$.mode') IS "__new_ingestion_runs"."mode" ELSE 0 END),
	CONSTRAINT "ingestion_runs_lifecycle_ck" CHECK(("__new_ingestion_runs"."status" = 'running' AND "__new_ingestion_runs"."finished_at" IS NULL AND "__new_ingestion_runs"."report_json" IS NULL AND "__new_ingestion_runs"."input_tokens" IS NULL AND "__new_ingestion_runs"."output_tokens" IS NULL AND "__new_ingestion_runs"."model_cost_usd" IS NULL AND "__new_ingestion_runs"."search_cost_estimate_usd" IS NULL AND "__new_ingestion_runs"."duration_ms" IS NULL AND "__new_ingestion_runs"."usage_complete" IS NULL) OR ("__new_ingestion_runs"."status" != 'running' AND "__new_ingestion_runs"."finished_at" IS NOT NULL AND "__new_ingestion_runs"."report_json" IS NOT NULL AND "__new_ingestion_runs"."input_tokens" IS NOT NULL AND "__new_ingestion_runs"."output_tokens" IS NOT NULL AND "__new_ingestion_runs"."search_cost_estimate_usd" IS NOT NULL AND "__new_ingestion_runs"."duration_ms" IS NOT NULL AND "__new_ingestion_runs"."usage_complete" IS NOT NULL)),
	CONSTRAINT "ingestion_runs_input_tokens_ck" CHECK("__new_ingestion_runs"."input_tokens" IS NULL OR (typeof("__new_ingestion_runs"."input_tokens") = 'integer' AND "__new_ingestion_runs"."input_tokens" >= 0)),
	CONSTRAINT "ingestion_runs_output_tokens_ck" CHECK("__new_ingestion_runs"."output_tokens" IS NULL OR (typeof("__new_ingestion_runs"."output_tokens") = 'integer' AND "__new_ingestion_runs"."output_tokens" >= 0)),
	CONSTRAINT "ingestion_runs_duration_ms_ck" CHECK("__new_ingestion_runs"."duration_ms" IS NULL OR (typeof("__new_ingestion_runs"."duration_ms") = 'integer' AND "__new_ingestion_runs"."duration_ms" >= 0)),
	CONSTRAINT "ingestion_runs_model_cost_usd_ck" CHECK("__new_ingestion_runs"."model_cost_usd" IS NULL OR "__new_ingestion_runs"."model_cost_usd" >= 0),
	CONSTRAINT "ingestion_runs_search_cost_estimate_usd_ck" CHECK("__new_ingestion_runs"."search_cost_estimate_usd" IS NULL OR "__new_ingestion_runs"."search_cost_estimate_usd" >= 0),
	CONSTRAINT "ingestion_runs_complete_ck" CHECK("__new_ingestion_runs"."usage_complete" IS NULL OR "__new_ingestion_runs"."usage_complete" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_ingestion_runs`("id", "event_id", "mode", "status", "started_at", "finished_at", "input_json", "report_json", "input_tokens", "output_tokens", "model_cost_usd", "search_cost_estimate_usd", "duration_ms", "usage_complete") SELECT "id", "event_id", "mode", "status", "started_at", "finished_at", "input_json", "report_json", "input_tokens", "output_tokens", "model_cost_usd", "search_cost_estimate_usd", "duration_ms", "usage_complete" FROM `ingestion_runs`;--> statement-breakpoint
DROP TABLE `ingestion_runs`;--> statement-breakpoint
ALTER TABLE `__new_ingestion_runs` RENAME TO `ingestion_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;