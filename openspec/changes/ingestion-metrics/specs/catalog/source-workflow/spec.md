# Spec Delta

## ADDED Requirements

### Requirement: Eligible traced ingestion records execution metrics
Eligible traced apply runs SHALL record operation durations and technical status for agent, model and tool execution, plus available model token usage. Metrics SHALL follow tracing eligibility and remain independent of application logging. Dry runs, injected candidate runs and runs with tracing disabled SHALL emit no ingestion metrics.

#### Scenario: Tracing without application logging
- **WHEN** an eligible apply run executes research, editing and tools with tracing enabled and logging disabled
- **THEN** their completed operations produce duration observations and available model token observations
- **AND** model usage includes available cache and reasoning categories without adding those subsets to total token counts

#### Scenario: Metrics are ineligible
- **WHEN** tracing is disabled or the run is a dry run or uses an injected candidate generator
- **THEN** no ingestion metric records are emitted, even if application logging is enabled
- **AND** when logging is also disabled, the attempt opens no observability store

#### Scenario: SDK emits another metric
- **WHEN** an eligible run emits a metric with a valid technical name and finite nonnegative value outside the currently observed duration and token names
- **THEN** the metric passes the same safe-field projection and persists without an application allowlist update
- **AND** malformed names are dropped with content-free diagnostics

#### Scenario: Technical success is not catalog success
- **WHEN** a tool completes normally with a failed retrieval result or successful editor generation is followed by plan rejection
- **THEN** operation metrics retain their technical status and host diagnostics retain the retrieval or editorial outcome separately
- **AND** an operation success count does not claim successful research or catalog mutation

### Requirement: Execution metrics retain safe correlation
Metrics SHALL retain the durable ingestion runId and real trace/span correlation. Agent, tool and model dimensions SHALL support useful grouping across runs with stable technical names. Stored metric context SHALL exclude prompts, message history, source bodies, full responses, transport payloads and raw errors. Metric labels SHALL exclude per-call URLs, queries and unique identifiers.

#### Scenario: Research and editor usage can be separated
- **WHEN** research and editor use the same model in one traced run
- **THEN** stored observations can be grouped by the responsible agent and model and correlated to the same durable run
- **AND** agent and tool group names remain stable across Events and attempts

#### Scenario: Unsafe content accompanies a metric
- **WHEN** an observability event contains forbidden content in metadata, labels or cost context
- **THEN** the stored metric retains only the selected safe technical fields, or is dropped if a safe projection cannot be produced
- **AND** no raw content appears in failure diagnostics

### Requirement: Metric costs identify their accounting basis
Model metrics SHALL retain valid provider-reported cost when available for the complete generation, otherwise an available pricing estimate. Their cost context SHALL distinguish reported cost from pricing estimates. Missing cost SHALL remain unknown and reported zero SHALL remain zero. Metric costs SHALL NOT be presented as complete ingestion spending or replace durable report accounting.

#### Scenario: Provider reports every completed step cost
- **WHEN** all completed steps in a model generation report valid costs
- **THEN** its metric cost retains their total once with provider-reported provenance
- **AND** summing total input/output token metric costs does not count the same generation charge twice

#### Scenario: Reported generation cost is incomplete
- **WHEN** a completed model step lacks a valid cost
- **THEN** metric cost uses an available pricing estimate with its basis identifiable, or remains unknown if pricing is unavailable
- **AND** the durable report continues to retain known reported cost subtotals under its existing contract

#### Scenario: Known zero and absent pricing
- **WHEN** a generation reports zero cost, or supplies usage without any reported cost or matching pricing
- **THEN** the former retains zero with reported provenance and the latter retains token observations without a cost value

#### Scenario: Search incurs additional charges
- **WHEN** discovery contributes model or search charges outside traced model generation
- **THEN** the durable report retains its existing accounting and model metrics do not claim to include those charges
- **AND** documentation explains this difference before comparing the two totals

### Requirement: Local metrics can be inspected after execution
Metrics SHALL remain queryable locally after exit, with totals, grouped values, time series and latency percentiles. Inspection SHALL require no model credentials or execution. Metric persistence SHALL use the existing local observability ownership and bounded cleanup rules. Failures SHALL NOT change catalog decisions, report accounting, durable lifecycle, eval acceptance or exit status.

#### Scenario: Inspect saved metrics
- **WHEN** a traced run exits and the owner reopens local inspection
- **THEN** saved metrics and their aggregates are available without rerunning research or accessing the catalog
- **AND** inspection can correlate observations with their saved trace and durable runId

#### Scenario: Metric persistence fails
- **WHEN** metric initialization, export, flush or shutdown fails
- **THEN** ingestion preserves its original result and attempts independent bounded cleanup with content-free diagnostics
- **AND** cleanup of a Studio attempt leaves the shared store usable for later attempts and inspection

#### Scenario: Historical observations have no metrics
- **WHEN** an existing observability store is opened after this change
- **THEN** existing logs and spans remain available and new runs can append metrics
- **AND** absent historical metrics are not backfilled or interpreted as zero usage

## MODIFIED Requirements

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL remain committed, rolled_back, unchanged, not_attempted or unknown independently of research status. The committed-operation count SHALL be null when transaction disposition is unknown; dry-run previews SHALL not be labelled committed. Logs and traces observing the same write phase SHALL agree on disposition and confirmed changed-operation count.

#### Scenario: Writer rejects an atomic item
- **WHEN** the writer rolls back after failure
- **THEN** the root records rolled_back and zero confirmed changed operations without claiming successful mutation

#### Scenario: No writer invocation occurs
- **WHEN** an attempt finishes without calling the catalog writer
- **THEN** its final write observations report not_attempted and zero committed operations, independently of unchanged, skipped or failed catalog outcome

#### Scenario: Writer returns without a committed change
- **WHEN** a writer invocation returns a no-op or a rolled-back dry-run preview
- **THEN** applicable logs and traces report unchanged and zero committed operations; preview remains identified as dry-run

#### Scenario: Write completion is unknown
- **WHEN** write execution started but no confirmed result or rollback is available
- **THEN** applicable observations retain unknown with a null committed-operation count

#### Scenario: Reporting fails after a confirmed commit
- **WHEN** catalog changes commit and later reporting fails
- **THEN** logs and traces retain committed and the confirmed changed-operation count alongside the reporting failure

### Requirement: Research logs cover actionable execution events
Enabled logging SHALL describe selected source retrieval, discovery, model steps, completed commentary and returned reasoning, tool calls/results, retries, errors, budget limits, plan validation, write outcomes and run completion. Status/count fields SHALL reflect the observed phase; successful completion SHALL follow durable finalization. Logging SHALL NOT replay work or change generation settings. Model-step and tool-call logs SHALL omit manually measured durationMs; operation timing SHALL come from enabled traces and metrics.

#### Scenario: Source was fetched
- **WHEN** a source returns Markdown
- **THEN** the source event records useful fields such as `sourceCharacters` and selected response status/URL
- **AND** no source Markdown or full response is passed to the logger

#### Scenario: A dry run previews writes
- **WHEN** catalog changes are previewed
- **THEN** the log distinguishes preview from committed writes and retains selected counts without claiming a commit

#### Scenario: Detailed logs without tracing
- **WHEN** logging is enabled while tracing is disabled
- **THEN** model/tool start and outcome events retain timestamps, context and selected results without durationMs fields or synthetic metrics
- **AND** whole-run duration in the report and completion log retains its existing meaning

### Requirement: Observability storage has explicit local ownership
Application logs, eligible traces and their execution metrics SHALL remain in local storage separate from the catalog. Contention with another process SHALL produce a bounded diagnostic without disrupting ingestion or taking ownership from that process. Existing historical files SHALL remain untouched; legacy conversion and inspection SHALL remain unsupported.

#### Scenario: Another process owns the store
- **WHEN** another process prevents opening the local observability store
- **THEN** it emits a bounded diagnostic and continues ingestion without taking ownership from that process
