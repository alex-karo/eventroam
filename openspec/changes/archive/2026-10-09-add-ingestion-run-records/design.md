# Design

## Context

See [proposal.md](proposal.md) for scope and [the delta](specs/catalog/source-workflow/spec.md) for behavior. `runCatalogResearch` handles one festival; the CLI iterates check targets independently. The existing version 2 report contains research/catalog outcomes, model output, operations, changes, sources, errors, configuration, and usage. The writer commits each item atomically or rolls it back for dry-run. Unexpected errors outside the writer currently become generic CLI failures. Evals use the same workflow with migrated temporary catalogs.

## Goals / Non-Goals

**Goals:** persist each attempt with two short writes, reuse the private report, and expose core statistics for SQL summaries while preserving writer atomicity.

**Non-Goals:** additional registries, per-step writes, recovery, changes to provider retries, new tracing spans/services, billing integrations, or model-cost subtotals. Other exclusions are in the proposal.

## Decisions

### Storage and input

Add `ingestion_runs` to `src/db/schema.ts` through an additive migration:

| Column | Type and meaning |
| --- | --- |
| `id` | Text primary key, UUID; report runId |
| `event_id` | Nullable text, no foreign key; existing or committed Event |
| `mode` | Required nonempty text, no enum or database allowlist; fixed at start |
| `status` | Required text: running/completed/failed |
| `started_at` | Required UTC ISO timestamp |
| `finished_at` | Nullable UTC ISO timestamp |
| `input_json` | Required normalized invocation parameters |
| `report_json` | Nullable final version 2 report |
| `input_tokens` | Nullable integer; usage.inputTokens, including discovery |
| `output_tokens` | Nullable integer; usage.outputTokens, including discovery |
| `model_cost_usd` | Nullable real; usage.modelCostUsd |
| `search_cost_estimate_usd` | Nullable real; usage.searchCostUsd |
| `duration_ms` | Nullable integer; durationMs |
| `usage_complete` | Nullable boolean stored as integer; usage.complete |

Running rows have null finish/report/statistics. Terminal rows require those values except model cost, which may remain unknown. Validate status, JSON, and lifecycle combinations in SQLite; enforce nonnegative/boolean checks plus safe integer counts and finite costs at application boundaries. Keep schema types independent of ingestion runtime imports. Store mode as a string from validated invocation input, without an enum or closed-list storage type/constraint. Current commands use add/refresh/check; new modes require no run-table migration. Preserve mode through finalization and match input_json.mode and report_json.mode when present.

`input_json` allowlists mode, supplied name or Event ID, actor/optional initiator, dryRun (default true), republish (default false), effective limits, requested model/reasoning/service tier, and prompt version. Exclude Markdown, page bodies, full Event context, prompts, credentials, environment/dependency dumps, and database/report paths. Never serialize `ResearchConfig`, which contains the API key.

Refresh/check set event_id at start. Add starts with null and resolves it during finalization for a matched existing Event (including skipped duplicates) or a committed new Event. Rolled-back creation IDs remain only in report JSON. No foreign key lets history survive catalog deletion; association does not imply successful mutation. An interrupted add can retain null event_id despite a committed Event.

The six statistic columns are projections of one normalized report, finalized together with status/time/event_id/report_json. Preserve zero and known incomplete counts; do not update statistics per step. Cached/reasoning subsets, counters, errors, and versions stay in JSON. Total tokens are input + output; no total-price column is added. Secondary indexes and additional tables are deferred until needed.

### Lifecycle and transaction boundaries

An ingestion-local persistence module uses the existing client; the workflow owns lifecycle for CLI and eval callers:

1. Validate input/target/configuration and effective limits. CLI preflight remains; direct callers validate targeted Events too. Reject an enclosing transaction before starting.
2. Generate runId/start time and commit running before context loading or source/model work. Insert failure aborts the attempt without external work or catalog mutation.
3. Run research and the atomic writer, retaining available state for failure reporting.
4. After item commit/rollback, finalize report, association, statistics, finish time, and status in one guarded update of the running row. Require exactly one affected row; terminal records cannot be overwritten.

No whole-research transaction or second connection is needed. Dry-run retains its run/report while facts, versions, audits, and receipts roll back. Apply starts fresh with a new runId. Eval rows live only in temporary catalogs.

Lifecycle is failed for a failed research/catalog result or unexpected workflow error; otherwise completed, including partial, unchanged, skipped, and recovered source errors. It is independent of researchStatus and catalog outcome.

### Reports and accounting

Return/store/export the same normalized report with runId, including original final modelResponse.text/object even after candidate rejection or write failure. Preserve report version 2; historical v2 without additive runId/searchCostBasis remain readable, unsupported versions remain rejected, and pre-start failures have no invented run report.

Keep reports private and bounded. They retain summaries/history, not full pages, prompts, credentials, transport payloads, headers, or raw exceptions; public reads do not expose them. Optional `--report` export happens after finalization, and export failure cannot change a terminal row.

Reuse current accounting:

- Research and discovery tokens are combined; cached/reasoning counts are subsets. Retain known counts on later failure, set usage.complete=false when accounting is incomplete, and keep unavailable subset details null. Completeness reflects accounting, not workflow success.
- Full modelCostUsd requires complete required usage/cost accounting; otherwise null. Reported zero remains zero. Existing reports discard partial cost subtotals: the provider regression retains 10/20 tokens after a later failure but turns an earlier USD 0.125 charge into null full cost. This change preserves the report, without recovering that subtotal.
- searchCostUsd is a formula-based estimate: `attempts * (0.007 + max(0, maxResults - 10) * 0.001)`. The counter includes unsuccessful attempts before a returned result; actual billing is unknown. Ultimately thrown searches return no cost object. Preserve the numeric field, add usage.searchCostBasis=estimate, and label CLI output “estimated search USD”. Historical missing markers do not establish billing provenance; usage.complete=true does not make cost exact.
- HTTP/Firecrawl lack billed-cost metadata. Do not invent retrieval charges or claim exact all-service spend.

### Workflow and persistence failures

Catch post-start workflow errors and finalize failed with host code workflow_failed, stage workflow, a fixed bounded message, and only established safe diagnostic fields. Reuse available budget/source/discovery/research/preparation/writer state with a small report fallback. If no usable research exists, status/outcome are failed and unavailable modelResponse is null; otherwise retain known research status and actual catalog outcome/receipts, even after commit. A late error must not imply rollback or make known accounting incomplete by itself.

Finalization stays outside that catch. Serialization/database/guarded-update failure leaves running with null finish/report/statistics and throws a bounded persistence error carrying runId and any available report. The CLI retains the result, emits run_persistence_failed with runId, and exits nonzero. workflow_failed also exits nonzero even with a preserved successful catalog outcome. Other check targets continue; never replay research, undo committed writes, or recursively finalize.

Abrupt exit leaves running with unknown result/usage. Reruns create new IDs from current catalog state without modifying earlier rows. Test unfinished rows and reruns through ordinary database/workflow tests; injected finalization failure covers preserved commits. No process-kill test, signals, heartbeats, or recovery is required.

### Trace/change correlation and eval integration

Main now has optional agent tracing in a separate LibSQL store; initial reads, preparation, and writes remain outside its spans. Pass the host-generated runId internally from workflow through researchFestival to createResearchTracing, including it in TraceMetadata and generation options. The sanitizer replaces span.metadata, so explicitly retain runId on every exported span. Do not put it in the research prompt or add a caller-supplied ID. Existing spans provide correlation without a trace_id column, extra spans, or exporter changes. Disabled/injected paths still create durable runs without traces. Trace initialization/export/cleanup failures remain diagnostics only: they cannot fail the run or eval, alter usage completeness, or become workflow_failed/run_persistence_failed. Preserve generationFinishedAt for deadline classification; derive statistics from the report, never spans. Missing/deleted traces do not invalidate run history.

Use report_json.operations.operationKey to locate catalog_changes.operation_key. One run has zero or many changes; dry-run leaves no audit rows. A direct catalog_changes.ingestion_run_id is deferred: it would require writer integration inside the item transaction, nullable for manual/historical writes. Consequently, a running attempt without a report may lack change correlation after commit.

Update both eval failure paths:

- `evals/run.ts` currently replaces any thrown error with empty model_failed output, losing runId and statistics. Handle typed persistence errors separately: retain available report/runId and attach safe run_persistence_failed for output while the database row remains running. Keep a bounded fallback for pre-start failures.
- `evals/score.ts` currently checks outcome/researchStatus only, so workflow_failed with a preserved successful outcome could pass. Reject workflow_failed and run_persistence_failed in both ordinary and expected-blocked-source acceptance, yielding failure scores and nonzero exit. Valid expected source failures and successful factual scoring remain unchanged.

Tests cover late report errors, available reports on finalization failure, and historical v2 compatibility; detailed acceptance cases and checks are in [tasks.md](tasks.md).

## Risks / Trade-offs

- Crash after commit can leave running/null association or missing change correlation → preserve catalog state and document unknown completion; do not infer failure from age.
- Scalar statistics duplicate JSON → derive once and finalize atomically; test exact equality.
- Accounting remains incomplete/estimated → preserve flags/nulls and document the missing subtotal.
- Private report history grows → retain bounded reports and private access; pruning is deferred.

## Migration Plan

1. Review migration and Drizzle snapshot/journal changes; test fresh and populated databases, preserving catalog data/audits/receipts. No backfill or fixture-seeded history.
2. Stop readers/writers, back up SQLite, migrate, and start the matching release. No new service/dependency is needed.
3. Update current-behavior guides and sync the owning spec once implemented; planning does not change main specs.
4. For application rollback, stop writers and retain the unused additive table. Restore backup only if database rollback is necessary, accounting for subsequent catalog changes.
