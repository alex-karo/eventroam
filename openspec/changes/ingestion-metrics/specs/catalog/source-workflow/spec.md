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

#### Scenario: Additional execution metrics are recorded
- **WHEN** an eligible run produces an execution metric beyond the currently observed duration and token names
- **THEN** that metric is also saved and available for inspection

#### Scenario: Technical success is not catalog success
- **WHEN** a tool completes normally with a failed retrieval result or successful editor generation is followed by plan rejection
- **THEN** operation metrics retain their technical status and host diagnostics retain the retrieval or editorial outcome separately
- **AND** an operation success count does not claim successful research or catalog mutation

### Requirement: Execution metrics retain run and operation context
Automatic agent, model and tool metrics SHALL retain the durable ingestion runId and real trace/span correlation. Their dimensions SHALL support grouping by the responsible agent or tool and model across runs.

#### Scenario: Research and editor usage can be separated
- **WHEN** research and editor use the same model in one traced run
- **THEN** stored observations can be grouped by the responsible agent and model and correlated to the same durable run
- **AND** agent and tool identifiers remain stable across Events and attempts

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

### Requirement: Local metrics can be inspected after execution
Metrics SHALL remain queryable locally after exit, with totals and values grouped by agent and model. Inspection SHALL require no model credentials or execution. Metric failures SHALL NOT change catalog decisions, report accounting, durable lifecycle, eval acceptance or exit status, or leave ingestion waiting indefinitely.

#### Scenario: Inspect saved metrics
- **WHEN** a traced run exits and the owner reopens local inspection
- **THEN** saved metrics and their aggregates are available without rerunning research or accessing the catalog
- **AND** inspection can correlate observations with their saved trace and durable runId

#### Scenario: Metric persistence fails
- **WHEN** recording or closing metrics fails
- **THEN** ingestion preserves its original result and emits a content-free diagnostic
- **AND** the attempt does not make Studio's shared store unavailable to later attempts or inspection

#### Scenario: Historical observations have no metrics
- **WHEN** an existing observability store is opened after this change
- **THEN** existing logs and spans remain available and new runs can append metrics
- **AND** absent historical metrics are not backfilled or interpreted as zero usage

## MODIFIED Requirements

### Requirement: One catalog-run trace covers the final result
Each eligible apply trace SHALL cover research, editing and the final write/report outcome. It SHALL expose research structural/target validation, editor plan validation/status and available report status/outcome. Editorial rejection SHALL preserve research checks and report failed plan validation. Unavailable results SHALL NOT be invented.

#### Scenario: Editorial rejection remains visible in diagnostics
- **WHEN** usable partial research is followed by an explicit editor rejection
- **THEN** preparation logs a warning for the rejected plan and the final trace label identifies editor rejection rather than partial completion
- **AND** retain research validation, editorStatus=success and failed editorPlanValidation

#### Scenario: Report construction fails after a commit
- **WHEN** a confirmed write succeeds but report construction fails
- **THEN** the root retains technical failure without inventing unavailable report fields

### Requirement: Research logs cover actionable execution events
Enabled logging SHALL describe selected source retrieval, discovery, model steps, completed commentary and returned reasoning, tool calls/results, retries, errors, budget limits, plan validation, write outcomes and run completion. Status/count fields SHALL reflect the observed phase; successful completion SHALL follow durable finalization. Logging SHALL NOT replay work or change generation settings. Model-step and tool-call logs SHALL omit `durationMs`. Enabled traces and metrics SHALL expose operation durations.

#### Scenario: Source was fetched
- **WHEN** a source returns Markdown
- **THEN** the source event records useful fields such as `sourceCharacters` and selected response status/URL
- **AND** no source Markdown or full response is passed to the logger

#### Scenario: A dry run previews writes
- **WHEN** catalog changes are previewed
- **THEN** the log distinguishes preview from committed writes and retains selected counts without claiming a commit

#### Scenario: Detailed logs without tracing
- **WHEN** logging is enabled while tracing is disabled
- **THEN** model/tool start and outcome events retain timestamps, context and selected results without `durationMs` fields or execution metrics
- **AND** whole-run duration in the report and completion log retains its existing meaning

### Requirement: Observability storage has explicit local ownership
Application logs, eligible traces and their execution metrics SHALL remain in local storage separate from the catalog. Contention with another process SHALL produce a bounded diagnostic without disrupting ingestion or taking ownership from that process. Existing historical files SHALL remain untouched; legacy conversion and inspection SHALL remain unsupported.

#### Scenario: Another process owns the store
- **WHEN** another process prevents opening the local observability store
- **THEN** it emits a bounded diagnostic and continues ingestion without taking ownership from that process

## REMOVED Requirements

### Requirement: Run traces distinguish write disposition from research outcome
**Reason**: Separate transaction-disposition and committed-operation-count summaries are no longer required in logs or traces. Ordinary completion/error events and durable report results remain available.
**Migration**: Use writer results and report receipts for operation details. A reporting failure after a write no longer guarantees a separate transaction summary in telemetry.
