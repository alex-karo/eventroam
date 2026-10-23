# Ingestion runs

## Purpose

Define private, durable attempt history and reports for local ingestion, including failures and incomplete accounting.

## Requirements

### Requirement: Every valid attempt has a durable lifecycle
After input and configuration validation, ingestion SHALL record a unique running attempt before source or model work. It SHALL record UTC start time, normalized input, and mode. Finalization SHALL update the same attempt with finish time and private report. Lifecycle status SHALL be separate from research status and catalog outcome. Invalid requests and help requests SHALL create no attempt.

#### Scenario: A valid attempt starts
- **WHEN** the owner starts a valid add or refresh
- **THEN** its running record exists before research and has no finish time or final report

#### Scenario: Several Events are targeted
- **WHEN** one command refreshes several Events
- **THEN** each started Event has a distinct attempt, input, lifecycle, and final report

#### Scenario: An attempt cannot finish
- **WHEN** the process stops before finalization
- **THEN** its record remains running without a finish time or claimed result

### Requirement: Attempts retain known Event association
Refresh SHALL associate its run with the targeted Event from the start. Add SHALL associate its run with a matched existing Event or an Event committed by the attempt when known. A previewed or rolled-back creation SHALL not create a persistent Event association. Event association SHALL NOT imply successful mutation.

#### Scenario: Duplicate add
- **WHEN** add recognizes an existing Event and skips it
- **THEN** the finalized run identifies that Event despite making no changes

#### Scenario: Previewed creation
- **WHEN** add previews a new Event that is rolled back
- **THEN** the run has no persistent Event association while the preview remains in its report

### Requirement: Reports distinguish work and outcome
Each final report SHALL identify its attempt, add or refresh mode, scope, research and editorial status, catalog outcome, source checks, questions, errors, and known record IDs. Each success status SHALL describe only the success of its operation, without certifying complete Edition or field checks. Outcomes SHALL distinguish `created`, `updated`, `published`, `unchanged`, `skipped`, and `failed`. Refresh SHALL show the frozen date and saved and returned Edition counts.

#### Scenario: A completed recheck changes nothing
- **WHEN** refresh confirms accepted facts without a change
- **THEN** the report identifies completed research and an unchanged catalog outcome

### Requirement: Reports retain findings and changes
Successful previews and writes SHALL show old and new values with reasons. Applied changes SHALL match the catalog audit. After a write failure, reports SHALL retain prepared operations, available model responses, and the write error. They SHALL NOT require a separate diff of proposed old and new values. A rolled-back write SHALL leave applied `changes` empty. Available final research and editorial responses SHALL remain separate. A no-op SHALL retain explicit decisions and useful source summaries without inferring field verification. The catalog outcome SHALL NOT stand in for research completeness.

#### Scenario: Research and editorial responses are available
- **WHEN** both stages return final text and structured output
- **THEN** the private report retains them separately as `modelResponse` and `editorResponse` without content filtering

#### Scenario: Research succeeds but writing fails
- **WHEN** a valid proposed update fails the catalog writer
- **THEN** the report retains research status, findings, prepared operations, and available model responses with the write-stage error
- **AND** applied `changes` is empty and a separate proposed diff is not required

#### Scenario: A source cannot be fetched
- **WHEN** a source read fails and no update is supported
- **THEN** its URL, UTC check time, and failure outcome remain visible without changing catalog facts

### Requirement: Output matches the stored final report
CLI, Studio, optional JSON export, and local run inspection SHALL use the same final report for a completed attempt. Failure to export an optional report file SHALL not alter a finalized run.

#### Scenario: JSON output is requested
- **WHEN** an attempt finishes and the owner requests JSON output or a report file
- **THEN** its run ID and report content match the stored final report

### Requirement: Report consumers reject unsupported versions
The current report contract SHALL use version 5. Consumers SHALL reject unsupported versions explicitly.

#### Scenario: An unsupported report version is read
- **WHEN** a consumer receives a report version it does not support
- **THEN** it rejects that version explicitly without silently converting or filling gaps

### Requirement: Command results reflect attempt failures
Failed research, editing, writing, or persistence SHALL produce a nonzero command result. Partial research alone SHALL not.

#### Scenario: Duplicate add is skipped
- **WHEN** add recognizes an existing Event without a host failure
- **THEN** it reports skipped and exits zero without catalog writes

#### Scenario: New Event creation is declined
- **WHEN** add produces usable research but concludes there is insufficient support to create a new Event
- **THEN** it reports skipped with the reason, exits zero, and makes no catalog or publication writes

### Requirement: Finalization reflects success and failure accurately
A non-failed catalog outcome without an unexpected host failure SHALL complete its lifecycle, including previews, unchanged checks, skipped duplicates, and useful partial research. Research, editorial, validation, or writer failure SHALL finalize as failed with available diagnostics. An unexpected error after start SHALL produce a bounded host error and preserve known committed outcomes and accounting without inventing unknown details.

#### Scenario: Partial research has a safe no-op
- **WHEN** research is partial but the catalog outcome is unchanged and no host failure occurs
- **THEN** the attempt completes while its report retains the unfinished questions

#### Scenario: Unexpected failure follows a commit
- **WHEN** a host error occurs after a catalog item commits
- **THEN** the report retains that known commit and safe failure details without claiming the whole run succeeded

### Requirement: Failure codes identify the failed boundary
The final report SHALL distinguish a model request failure before usable output as `model_failed`, a structurally invalid returned candidate as `invalid_candidate`, and research budget exhaustion as `limit_reached`. Budget exhaustion SHALL retain precedence when a model failure also occurs at the limit. Each code SHALL retain available safe diagnostics and known usage without inventing missing details.

#### Scenario: Provider fails before a candidate
- **WHEN** a model request fails without a usable final result and the research budget is not exhausted
- **THEN** the run reports `model_failed` with available safe error details

#### Scenario: Returned candidate is malformed
- **WHEN** a returned candidate contains a malformed source or official-link URL
- **THEN** the run reports `invalid_candidate`, retains the returned result and source-read history privately, and makes no catalog changes

#### Scenario: Research budget is exhausted
- **WHEN** research reaches its step or time limit without a valid result
- **THEN** the run reports `limit_reached` with a limit reason, known usage, source-read history, and available model questions
- **AND** it does not require or invent a complete list of unfinished checks

### Requirement: Run persistence failures do not replay work
Failure to create the running record SHALL stop the attempt before research or mutation. Failure to save final status and report SHALL yield a safe persistence error and nonzero result, correlated by run ID where available. It SHALL leave the run record unfinished and SHALL NOT replay research, undo confirmed catalog commits, or claim durable finalization.

#### Scenario: Start cannot be saved
- **WHEN** the running record cannot be persisted
- **THEN** no source, model, or catalog work starts for that attempt

#### Scenario: Finalization fails after apply
- **WHEN** catalog changes commit but the final run update fails
- **THEN** the command reports persistence failure with the run ID, the changes remain committed, and the run record remains unfinished

### Requirement: Usage reports retain known accounting limits
Final reports SHALL retain duration, model and budget settings, known tokens and model cost, estimated search cost, and token-accounting completeness. Known charges SHALL be summed once; missing charges SHALL remain unknown. Cached-input and reasoning counts SHALL remain subsets of token totals. Later failure SHALL not erase known usage. Search estimates SHALL not claim exact spending or billed attempts.

#### Scenario: A later call fails
- **WHEN** earlier calls reported tokens and cost but a later call fails without usage
- **THEN** the report retains the known counts and cost, marks token accounting incomplete, and invents no missing charge

#### Scenario: No model cost is known
- **WHEN** no completed call supplies model cost
- **THEN** model cost remains unknown rather than zero

#### Scenario: Search cost is estimated
- **WHEN** discovery supplies a search cost estimate
- **THEN** the report retains the estimate with its basis and does not present it as a provider charge

### Requirement: Core statistics are queryable with run history
Run records SHALL expose nullable `input_tokens`, `output_tokens`, `model_cost_usd`, `search_cost_estimate_usd`, `duration_ms`, and `usage_complete` values. A finalized record's values SHALL match its report, including known zeros and incomplete accounting. An unfinished attempt SHALL leave final statistics unknown rather than zero.

#### Scenario: A run finalizes with incomplete usage
- **WHEN** the final report has known counts but incomplete token accounting
- **THEN** queryable statistics retain those counts and mark completeness false

#### Scenario: A run remains unfinished
- **WHEN** finalization fails or the attempt is interrupted
- **THEN** its final statistics, finish time, and report remain absent

### Requirement: Run history remains private and bounded
Stored inputs SHALL contain normalized operation settings and safe configuration metadata. Reports SHALL retain available final model responses without content filtering, even when they repeat prompt or public source text. Public source URLs SHALL retain their components within existing field length limits. The application SHALL NOT scan model responses or public source URLs for secrets or redact their content. It SHALL NOT separately copy application or SDK credentials, environment dumps, prompts, full source bodies, headers, provider transport payloads, or raw exceptions into reports. These field exclusions SHALL NOT override model-response preservation. Run records SHALL NOT be exposed through public website reads.

#### Scenario: A provider error contains sensitive content
- **WHEN** a caught exception contains request or response content
- **THEN** the persisted error uses available recognized type, HTTP status, provider or network code, and retryability within bounded safe fields without that raw content

#### Scenario: Research reads a page
- **WHEN** research uses a full page body to produce findings
- **THEN** the private report retains the model's summary and available final response
- **AND** text repeated by the model remains, but the application does not attach the page body or prompt separately
