import { readFileSync } from "node:fs";

const references = new URL(
  "../mastra/catalog-assistant/skills/catalog-sql/references/",
  import.meta.url,
);

export const INSPECT_RUN_SQL = readFileSync(
  new URL("inspect-run.sql", references),
  "utf8",
).trim();
export const INSPECT_RUN_STATE_SQL = readFileSync(
  new URL("inspect-run-state.sql", references),
  "utf8",
).trim();
export const RUN_EVIDENCE_SQL = readFileSync(
  new URL("run-evidence.sql", references),
  "utf8",
).trim();
export const BATCH_COUNTS_SQL = readFileSync(
  new URL("batch-counts.sql", references),
  "utf8",
).trim();
export const BATCH_JOBS_SQL = readFileSync(
  new URL("batch-jobs.sql", references),
  "utf8",
).trim();
