# Proposal

## Why

Ingestion reports currently survive only in terminal output or an optional file. Optional Mastra traces cover agent execution in a separate best-effort store, not the complete attempt or catalog outcome. Store each festival attempt in the existing database to retain its result, errors, known token usage, costs, and runtime statistics even when no catalog facts change.

## What Changes

- Add one `ingestion_runs` table with required free-text `mode` and nullable `event_id`: a running row at the start of each validated festival attempt, finalized with a timestamp and the existing private report at completion or caught failure. Associate it with an existing or committed Event when known; keep transient preview IDs only in the report.
- Give each attempt a `runId`, shared by the stored report, CLI output, JSON, optional `--report` file, and enabled research-span metadata. Multi-Event checks create independent rows; trace failures remain independent of run status and accounting.
- Keep lifecycle status (`running`, `completed`, `failed`) separate from research status and catalog outcome. Preserve available statistics when a post-start workflow error occurs.
- Retain run records for dry-run, unchanged, skipped, and failed attempts while preserving catalog rollback and atomic item writes.
- Expose input/output token counts, model cost, estimated search cost, duration, and usage completeness as scalar columns for simple SQL summaries; derive them from the same final report in the finalization update.
- Persist existing usage with its completeness and unknown values. Label formula-based search cost as an estimate, separately from provider-reported model cost; do not infer missing usage, retrieval charges, or exact total spend. Reusing the current report does not recover a known model-cost subtotal discarded after a later failure.
- Abort before research if the start record cannot be saved. Surface finalization failures without repeating research or undoing committed catalog changes. Abrupt interruption leaves a running row; a rerun creates a new attempt.

Out of scope: implementation in this proposal, historical backfill, batch/step/source registries, changes to existing provider retries, recovery, heartbeats, signal handlers, history commands or UI, new tracing services or spans, pricing tables, and new billing integrations.

## Capabilities

### New Capabilities

None. Run lifecycle and reporting belong to the existing source workflow capability.

### Modified Capabilities

- `catalog/source-workflow`: require durable per-festival run records, correlated private reports, honest usage retention, explicit dry-run history, and interruption/persistence-failure behavior.

## Impact

- SQLite/Drizzle schema and a reviewed additive migration in `src/db/`.
- Lifecycle persistence in `src/ingestion/`, coordinated by `workflow.ts`; additive report contracts and safe unexpected-error reporting.
- CLI formatting/failure correlation in `commands/catalog.ts`, existing report builders, tests, and temporary eval catalogs. Eval handling must preserve available reports on persistence failure and reject host workflow/persistence failures even when catalog outcomes remain successful.
- Ingestion/development/structure documentation will need implementation-time updates; this proposal is linked from the documentation index now.
- No new dependencies, public website contracts, catalog operation types, or Event foreign keys are required. Existing databases must be migrated before running the updated ingestion command.
