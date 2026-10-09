# Source-backed catalog workflow delta

## MODIFIED Requirements

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add`, `refresh`, or `check`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 2. Failed research/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers. Each started festival attempt SHALL have a durable run record and a stable `runId` in CLI text, JSON, eval results, and optional saved reports; these additive fields SHALL retain report version 2.

#### Scenario: Preserve the final model response
- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain its final text and unnormalized structured object in `modelResponse`, separately from catalog operations
- **AND** the response remains available when candidate validation or writing fails
- **AND** unavailable responses or components are recorded as null, without copying prompts, page bodies, or transport metadata

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** research and discovery requests send that effort and reports identify the requested setting
- **AND** omitting the setting explicitly selects `medium`
- **AND** reports accumulate provider-reported input, output, cached input, and reasoning token counts from completed steps, retaining those counts when a later step fails or is interrupted and using null for unavailable cached input or reasoning details
- **AND** reports set `usage.complete` to false when a call fails, is interrupted, lacks token usage, or includes unaccounted discovery attempts; the CLI marks the known token counts as partial
- **AND** reports include a full model cost only when all calls' usage and costs are known, otherwise using null; an explicitly reported zero cost remains zero

#### Scenario: Unchanged recheck
- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

#### Scenario: Source cannot be fetched
- **WHEN** a known source fails to load and the model proposes no changes
- **THEN** the report identifies the attempted URL, check time, and failure without changing catalog facts or audit history

#### Scenario: Explanations survive dry-run reporting
- **WHEN** an explained factual proposal produces a dry-run diff
- **THEN** the report retains its reason alongside the actual previewed old/new values and retains source summaries separately
- **AND** the dry run retains no catalog fact, version, audit, or receipt changes, while its ingestion run record and final report persist

#### Scenario: Research succeeds but writing fails
- **WHEN** the writer rejects valid research operations
- **THEN** preserve research status, report write-stage error/outcome failed, and commit no catalog item changes while retaining a failed ingestion run record

#### Scenario: Partial no-op remains visible
- **WHEN** partial research changes nothing
- **THEN** text/JSON show partial plus unchanged, separating questions from errors

#### Scenario: Only the new report contract is supported
- **WHEN** a consumer receives an unsupported report version
- **THEN** it rejects that version explicitly, without legacy gaps fallback or automatic conversion
- **AND** new reports use version 2 and do not emit gaps

#### Scenario: Saved output correlates with the database
- **WHEN** an attempt finishes and the owner requests JSON output or a `--report` file
- **THEN** its result has the same runId and report content as the stored final report
- **AND** failure to write the optional file does not erase or change the finalized run record

### Requirement: Dry runs preview changes without applying them
The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run. Dry-run SHALL use a transaction on the catalog database and roll it back without retained catalog record, version, audit, or receipt changes; it SHALL NOT create a database copy. The ingestion run record and final preview report SHALL persist outside that rollback.

#### Scenario: Dry run of a venue correction
- **WHEN** the owner requests a dry run for a model-proposed venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged
- **AND** its run record and final preview report persist

#### Scenario: Dry-run addition has transient catalog identifiers
- **WHEN** dry-run previews creating an Event and its Occurrences
- **THEN** those catalog rows, versions, audit entries, and receipts are rolled back
- **AND** the finalized run report retains the preview, including transient identifiers, without requiring those identifiers to reference retained catalog records

### Requirement: Interrupted collection can be rerun from current state
After interruption, a new owner-initiated run SHALL reload the catalog and research again with new operation keys. Committed changes SHALL remain; incomplete item transactions SHALL roll back. Existing writer receipt idempotency SHALL remain supported. An attempt stopped before finalization SHALL remain running with no finish time or final report; this SHALL NOT be treated as proof of success or failure. Reruns SHALL create new run records without changing earlier records. Automatic run recovery and a history-viewing command are outside this change.

#### Scenario: Owner reruns after interruption
- **WHEN** a run stops after one festival is committed and the owner starts it again
- **THEN** the new run uses current catalog state without duplicating that festival or resuming a saved operation file

#### Scenario: Process stops after catalog commit
- **WHEN** the process is killed after an item commit but before run finalization
- **THEN** committed catalog changes remain and the attempt remains running with unknown final result and usage
- **AND** a new owner-initiated attempt has a different runId and starts from current catalog state

## ADDED Requirements

### Requirement: Every festival attempt has a durable lifecycle
After input and configuration validation, the system SHALL persist a running record in the selected catalog database before context/source/model work. Each attempt SHALL have a unique ID, UTC start time, safe normalized input, and required nonempty text mode, fixed at start and equal to mode in input and final report JSON. Finalization SHALL update the same record with UTC finish time and private report. Lifecycle status SHALL be separate from research status and catalog outcome.

#### Scenario: Start is recorded before work
- **WHEN** a valid festival attempt begins
- **THEN** its running row is visible before any research context load, source request, or model call, with no finish time or final report
- **AND** invalid input or configuration and help requests do not create run rows

#### Scenario: Mode is available before a final report
- **WHEN** an add, refresh, or check attempt starts
- **THEN** its mode column equals input_json.mode and remains queryable while running or after interruption
- **AND** finalization preserves that mode and report_json.mode agrees with it

#### Scenario: Storage accepts evolving mode names
- **WHEN** the application introduces another supported invocation mode
- **THEN** run storage accepts its nonempty text name without a table migration or closed-list enum/type/constraint
- **AND** command validation remains responsible for deciding which workflows can execute

#### Scenario: Multiple targets have independent attempts
- **WHEN** check researches several Events
- **THEN** each started Event attempt has its own runId, input, lifecycle, and report; one failed attempt does not prevent the remaining attempts

#### Scenario: Non-failing results complete the lifecycle
- **WHEN** an attempt returns a non-failed catalog outcome without an unexpected workflow error
- **THEN** its lifecycle is completed, including partial research, unchanged checks, skipped duplicates, and dry-run previews
- **AND** recovered source errors do not by themselves make its lifecycle failed

#### Scenario: Research or writer failure finalizes the attempt
- **WHEN** research fails, a candidate is rejected, a limit is exhausted without usable data, or the atomic writer fails
- **THEN** the same row becomes failed with a finish time and final report containing the result, errors, and available statistics
- **AND** the command exits nonzero without relaxing catalog atomicity

#### Scenario: Unexpected post-start error is recorded safely
- **WHEN** an unexpected error occurs after the running row was persisted
- **THEN** the attempt is finalized as failed with a bounded host-generated workflow error and the best available report fields and statistics, and the command exits nonzero
- **AND** known research status, committed catalog outcomes/receipts, source history, model output, and usage are retained where available; unknown details are not invented

### Requirement: Run records identify their associated Event when known
Each run record SHALL have nullable event_id for an existing requested/matched Event or one committed by the attempt. Refresh/check SHALL set it at start; add SHALL start with null and resolve it at finalization. Rolled-back creation identifiers SHALL remain only in the report. Event association SHALL NOT require a foreign key or imply successful mutation.

#### Scenario: Targeted attempt starts with its Event association
- **WHEN** a validated refresh/check attempt starts
- **THEN** its running record has the requested event_id, including when research later fails

#### Scenario: Add resolves a persistent Event
- **WHEN** add matches an existing Event or commits a newly created Event
- **THEN** finalization stores that Event ID in event_id, including a skipped duplicate or later workflow error after commit

#### Scenario: Add does not retain a created Event
- **WHEN** a creation is previewed and rolled back or fails without committing an Event
- **THEN** event_id remains null, while proposed/preview identifiers remain in the report where available
- **AND** failed research before Event resolution also leaves event_id null

### Requirement: Stored run statistics retain accounting limits
Final run reports SHALL retain existing duration, model/prompt configuration, budgets, token usage, provider-reported model cost, estimated search cost, and completeness metadata. New reports SHALL mark searchCostBasis as estimate. Unknown accounting SHALL remain unknown. Stored runs SHALL NOT add token subsets to totals, invent usage/retrieval charges, or claim exact spending. Partial model-cost subtotals absent from the existing final report are outside this change.

#### Scenario: All reported statistics survive storage
- **WHEN** completed research and discovery return usage, model costs, and search-cost estimates
- **THEN** the persisted report retains their combined input/output tokens, cached-input and reasoning subsets, modelCostUsd, searchCostUsd, usage.complete, duration, and budget snapshot
- **AND** explicitly reported zero model costs remain zero and usage.searchCostBasis is estimate

#### Scenario: Search retries produce a formula-based estimate
- **WHEN** a discovery result returns after unsuccessful search attempts and calculates searchCostUsd from its attempt count and fixed formula
- **THEN** storage/JSON/eval output retain the numeric estimate with usage.searchCostBasis equal to estimate, and CLI text labels it estimated search USD
- **AND** the report does not claim that each attempt was billed or that usage.complete proves exact cost

#### Scenario: A later call fails after known usage
- **WHEN** some calls report usage and a later call fails or lacks accounting
- **THEN** the final report preserves known input/output counts, sets usage.complete to false, and keeps full modelCostUsd null when not fully known
- **AND** unavailable cached-input/reasoning details remain null; available search estimates are retained without being presented as provider-reported charges or complete spending

#### Scenario: Retrieval has no billed-cost metadata
- **WHEN** HTTP or Firecrawl retrieval does not supply billing metadata
- **THEN** retain available source outcomes and page counters without inventing a retrieval charge or interpreting missing charges as free service

### Requirement: Run persistence failures are visible without replaying work
Failure to save a running row SHALL abort that attempt before research. Failure to save its final status/report SHALL produce a safe persistence failure and nonzero command result, correlate it by runId when a start row exists, and leave that row running. Persistence failures SHALL NOT automatically retry research, undo committed catalog writes, or report successful durable finalization.

#### Scenario: Start insert fails
- **WHEN** the start record cannot be inserted, including because the database has not received the required migration
- **THEN** no context/source/model work or catalog mutation occurs for that attempt, and the command reports failure

#### Scenario: Final update fails after apply
- **WHEN** the catalog item committed but finalization fails
- **THEN** the command reports a persistence failure with runId, retains the available result for output, and exits nonzero
- **AND** catalog changes remain committed and the row remains running without a finish time or final report

### Requirement: Core run statistics are queryable as columns
Run records SHALL expose input_tokens, output_tokens, model_cost_usd, search_cost_estimate_usd, duration_ms, and usage_complete as nullable scalar columns. They SHALL start null and be finalized atomically from the same final report. Known incomplete counts SHALL retain a false completeness flag; unknown model cost SHALL remain null. Projected values SHALL be nonnegative, and completeness SHALL be boolean when set.

#### Scenario: Final statistics match the report
- **WHEN** an attempt is finalized, successfully or with a caught failure
- **THEN** the six columns equal usage.inputTokens, usage.outputTokens, usage.modelCostUsd, usage.searchCostUsd, durationMs, and usage.complete in report_json
- **AND** token totals include discovery, search cost remains an estimate, and known zero values remain zero

#### Scenario: Unfinished attempts have no final statistics
- **WHEN** a run is still running or its finalization fails
- **THEN** all six statistic columns remain null along with finish time and report_json, without claiming zero usage or cost

#### Scenario: A finalized report has incomplete accounting
- **WHEN** a final report contains known token counts but incomplete usage and unknown full model cost
- **THEN** the columns retain those counts, set usage_complete to false, and leave model_cost_usd null

### Requirement: Eval acceptance distinguishes host failures from expected research failure
Eval output SHALL preserve runId and available report data when finalization fails and SHALL identify safe host workflow/persistence failures. Those failures SHALL invalidate eval acceptance even when research/catalog outcomes are successful or a source-failure case otherwise meets expectations. Historical version 2 reports lacking additive runId/searchCostBasis fields SHALL remain readable.

#### Scenario: A late workflow error follows useful research
- **WHEN** an eval report retains successful research and a non-failed catalog outcome but contains workflow_failed
- **THEN** the case fails eval acceptance and the command exits nonzero while retaining its facts, runId, and available statistics

#### Scenario: Eval finalization fails with an available report
- **WHEN** a persistence error carries the report and runId of a started eval attempt
- **THEN** eval output retains them with a safe run_persistence_failed error rather than replacing them with an empty model-failure report
- **AND** the case fails acceptance, the command exits nonzero, and the database row remains running

#### Scenario: Expected source failure also has a host failure
- **WHEN** a blocked-source case otherwise matches its expected failed research but contains workflow_failed or run_persistence_failed
- **THEN** it fails eval acceptance; expected source failure alone remains acceptable when all existing criteria hold

### Requirement: Run records remain private bounded reports
Run input SHALL include only normalized operation settings and safe configuration metadata. Stored final reports SHALL retain the existing private report contract, including final model output, without storing credentials, environment dumps, prompts, full source pages, provider transport payloads, headers, or raw exception messages. Run records SHALL NOT be exposed through public website reads.

#### Scenario: Failure contains sensitive provider content
- **WHEN** a caught exception includes credentials or provider request/response content
- **THEN** store a fixed bounded error message and only recognized safe diagnostic fields, without copying the raw exception or transport data

#### Scenario: Source pages and model output are separate
- **WHEN** research reads page bodies and produces a final text/object response
- **THEN** persist the final modelResponse and safe source summaries/history, without copying source page bodies or the research prompt

### Requirement: Optional research traces correlate without governing run history
Enabled research spans SHALL retain the host-generated ingestion runId in sanitized metadata. Durable run lifecycle, accounting, and eval acceptance SHALL remain independent of optional best-effort tracing. Run storage SHALL NOT require trace records or derive statistics from spans.

#### Scenario: Enabled agent spans identify the attempt
- **WHEN** a started ingestion attempt executes the real agent with tracing enabled
- **THEN** every exported research span retains the same runId as the run row and report after sanitization
- **AND** the identifier is passed internally without adding it to the research prompt or exposing report contents in traces

#### Scenario: Tracing is absent or fails
- **WHEN** tracing is disabled, an injected generator bypasses it, or trace initialization/export/cleanup fails or loses spans
- **THEN** durable run recording still follows the research/catalog result and its report accounting
- **AND** trace diagnostics alone do not change lifecycle status, usage completeness, command exit status, or eval acceptance, nor become workflow/persistence failures
