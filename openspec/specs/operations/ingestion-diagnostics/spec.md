# Ingestion diagnostics

## Purpose

Define required workflow history, optional execution observations, and the fields stored for owner inspection on the selected host.

## Requirements

### Requirement: Logging and tracing are independently optional

The owner SHALL be able to enable local application logging independently of tracing. Both SHALL be off by default without changing ingestion behavior. Enabled tracing and execution metrics SHALL be available for apply, preview, and evaluation runs, including runs with injected dependencies. Observability failure SHALL NOT change research decisions, catalog writes, durable run history, reports, scoring, or exit status.

#### Scenario: Logging without tracing

- **WHEN** the owner enables logging but not tracing
- **THEN** selected events may be inspected without trace spans or execution metrics

#### Scenario: Tracing without logging

- **WHEN** an apply or preview run enables tracing but not logging
- **THEN** spans and available metrics may persist without application log records

#### Scenario: Observability storage fails

- **WHEN** an observability store cannot be opened, written, or closed
- **THEN** ingestion keeps its original result and emits a diagnostic

#### Scenario: Another process owns observability storage

- **WHEN** another process prevents opening the local store
- **THEN** ingestion continues with a diagnostic without taking ownership from that process

#### Scenario: A preview has tracing enabled

- **WHEN** the owner enables tracing for a dry-run
- **THEN** available observations persist separately from the catalog
- **AND** the preview retains no catalog record, version, audit, or receipt changes

#### Scenario: An evaluation uses injected tools

- **WHEN** tracing is enabled for an evaluation case with injected tools or model responses
- **THEN** available observations retain case and execution correlation
- **AND** mocked calls do not invent token usage or costs

### Requirement: Observability remains local and correlated

Enabled logs, traces, and metrics SHALL remain separate from the catalog. Studio SHALL expose them after exit on the selected host without model credentials or a new run. Application logs SHALL retain the durable run ID. Traces and metrics SHALL identify their run and Event. Inspection SHALL distinguish Research, Editor, Location, and catalog outcomes from technical execution status. Phase, validation, and Edition details SHALL remain available in saved execution results and reports.

#### Scenario: Inspect a completed run

- **WHEN** the owner opens local inspection after a run exits
- **THEN** available observations can be correlated with its durable run ID without executing research

#### Scenario: Retrieval fails without throwing

- **WHEN** a source operation completes technically but returns a failed retrieval outcome
- **THEN** diagnostics retain that retrieval failure rather than claiming a successful source check

### Requirement: Private traces can retain detailed content

Private stored traces MAY retain prompts, message history, source bodies, model responses, tool results, and execution errors. Known sensitive fields SHALL be filtered, and the application SHALL NOT attach configuration credentials. Filtering SHALL NOT be presented as a guarantee that arbitrary text contains no secrets. Tool outputs SHALL remain intact except for sensitive-field filtering. Application logs MAY retain source status, cache, and truncation summaries.

#### Scenario: A model span includes prompt content

- **WHEN** tracing receives automatically attached prompts or message history
- **THEN** that content may persist in private traces with sensitive-field filtering

#### Scenario: A source read is traced

- **WHEN** an inspected source produces content and links
- **THEN** the tool result may persist in private traces and application logs may retain source status details

### Requirement: Application logs use selected bounded fields

Enabled application logs SHALL identify severity, a short message, run ID, and selected run or source context. They SHALL cover retrieval, discovery, model, validation, write, and completion outcomes. They SHALL NOT separately copy full prompts, source content, transport data, configuration credentials, or raw exceptions. Public URLs and permitted model text MAY remain visible. Unobserved outcomes SHALL NOT be fabricated.

#### Scenario: A source is fetched

- **WHEN** a source read returns content
- **THEN** a log may retain its URL, status, and content length without the source text

#### Scenario: A preview is logged

- **WHEN** a preview reports proposed catalog changes
- **THEN** logs distinguish the preview from committed writes

#### Scenario: Observability emits its own diagnostics

- **WHEN** observability emits a warning or error
- **THEN** its message may appear in stderr
- **AND** private observability logs may retain payloads and errors
- **AND** delivery to both stderr and Studio is not guaranteed

### Requirement: Logged model text is separate and limited

Application logs MAY include two separate text fields from a completed model step: model commentary and reasoning text returned by the provider. Each field SHALL contain at most 4,000 Unicode code points and identify its original length and whether it was shortened. These events SHALL NOT collect incomplete streaming text, infer reasoning the provider did not return, or duplicate final structured results.

#### Scenario: Completed model text is long

- **WHEN** model commentary or returned reasoning exceeds 4,000 Unicode code points
- **THEN** the saved event contains only the first 4,000 code points of that field, its original length, and a shortening flag

### Requirement: Studio inspection exposes execution progress

Local or hosted Studio SHALL expose the flow, progress, execution ID, run ID, and available research, editorial, Location, geocoding, source, catalog, and report outcomes. Opening inspection SHALL NOT start work or require model credentials. Execution state SHALL exclude credentials, authenticated provider URLs, prompts, full page bodies, transport payloads, live resources, and raw exceptions. Final model responses SHALL follow ingestion-run rules. Concurrent attempts SHALL remain distinct. Opening saved inspection SHALL NOT require an active catalog connection. Saved run inspection SHALL expose the original input, available step statuses and times, and available step results after process exit.

#### Scenario: Open Studio without execution prerequisites

- **WHEN** the owner opens the ingestion view without model credentials
- **THEN** the flow and saved observations are inspectable without starting a run

#### Scenario: Inspect a failed attempt

- **WHEN** an attempt fails after returning research findings
- **THEN** Studio exposes available phase outcomes, model responses, and the failure stage without separately attaching page bodies or provider payloads

#### Scenario: An active execution ID is reused

- **WHEN** a caller supplies an execution ID already in use
- **THEN** Studio rejects that execution before work without affecting the original attempt

#### Scenario: Inspect saved step results

- **WHEN** the owner opens a saved ingestion execution after the writing process exits
- **THEN** Studio exposes its input and available step states, times, outputs, and final summary
- **AND** research findings, editorial actions, Location decisions, normalized geocoding observations, prepared operations, and confirmed write results remain distinguishable
- **AND** technical execution success does not replace research status, editorial status, Location status, catalog outcome, or report persistence status

#### Scenario: A start request includes private request context

- **WHEN** a start request carries separate credentials, prompts, source bodies, or provider payloads in request context
- **THEN** saved history excludes that request context while retaining allowed final model responses

### Requirement: Source-result capture is explicit and separate

The owner MAY enable local capture with `CATALOG_CAPTURE_TOOL_OUTPUTS=true`. It SHALL save bounded source and discovery results supplied to research, including initial context and repeated cached results in call order. Capture SHALL be off by default, identified by run ID, and kept in ignored local debug storage. Capture SHALL NOT separately attach source bodies or search responses to runs or reports. Capture write failure SHALL be visible without changing ingestion's outcome.

#### Scenario: Capture is enabled

- **WHEN** the owner enables capture and research reads a page and a discovery result
- **THEN** the saved capture contains those agent-visible bounded results and identifies their order and run ID
- **AND** traces and model responses follow their separate content rules above

#### Scenario: Capture is disabled

- **WHEN** the owner does not enable capture
- **THEN** no source-result capture files are created

#### Scenario: Capture cannot be written

- **WHEN** local debug storage rejects a capture write
- **THEN** the owner receives a diagnostic and the ingestion outcome is unaffected

### Requirement: Execution metrics remain inspectable and qualified

Enabled tracing SHALL record available stage duration, technical status, token usage, and model cost with run correlation. Research, editor, and Location SHALL be distinguishable. Reported and estimated costs SHALL remain distinct; missing cost SHALL NOT become zero. Metrics SHALL remain inspectable after exit without claiming complete spending. Reports and run-history statistics SHALL NOT maintain copies of token or cost totals. Metric failure SHALL NOT alter catalog or report outcomes.

#### Scenario: Research and editing use the same model

- **WHEN** an eligible run records both operations
- **THEN** their observations can be grouped separately while correlating to the same durable run

#### Scenario: Provider cost is incomplete

- **WHEN** a model operation lacks complete reported cost
- **THEN** its metric identifies an available pricing estimate as such, or leaves cost unknown

#### Scenario: Metrics cannot be persisted

- **WHEN** metric recording or shutdown fails
- **THEN** the run keeps its original result and a diagnostic is available

#### Scenario: Location has geocoding failures

- **WHEN** Location completes technically after a geocoding error
- **THEN** inspection distinguishes the provider error, the Location execution result, and the final catalog outcome
- **AND** it does not expose the authenticated request URL

#### Scenario: Initial geocoding precedes the model

- **WHEN** Location context preparation makes forward or reverse requests
- **THEN** inspection identifies these requests separately from later agent tool calls
- **AND** no model generation or usage is invented for preparation

### Requirement: Location evaluation separates completion correction and preservation

Location evaluation SHALL report missing-point completion, known-error correction, and correct-old-point preservation as separate case groups. Completion and correction cases SHALL require the expected point or precision change, so keeping every point SHALL NOT pass them. Preservation cases SHALL reject unwanted changes. Group results SHALL NOT claim an accuracy percentage or an untested quality guarantee.

#### Scenario: A plan keeps every point

- **WHEN** the evaluated agent returns keep for cases that require completion or correction
- **THEN** those cases fail their change assertions even if preservation cases pass

#### Scenario: A correct old point is changed

- **WHEN** a preservation case produces an unwanted point or precision change
- **THEN** the preservation case fails independently of completion and correction results

### Requirement: Location evaluation uses captured geocoding

Isolated Location evaluation SHALL execute Location with recorded forward and reverse geocoding results. Missing fixtures SHALL follow [Geocoding fixture gaps use a tool error](../ingestion-evaluation/spec.md#requirement-geocoding-fixture-gaps-use-a-tool-error). Saved results SHALL retain available output, initial observations, agent tool calls, errors, and scores. They SHALL NOT contain a fabricated ingestion report.

#### Scenario: An initial reverse fixture is missing

- **WHEN** initial preparation requests a reverse response absent from the fixture
- **THEN** the case retains the `unavailable` observation without a live request
- **AND** available later Location output and other case results remain in saved experiments
- **AND** the missing fixture alone does not fail the case

#### Scenario: The agent requests an uncaptured spelling

- **WHEN** an agent forward request has no matching fixture but a later decision is valid
- **THEN** the case retains the `unavailable` tool error and available decision
- **AND** it passes if execution and all case checks pass

#### Scenario: A fixture records no match or a provider failure

- **WHEN** a matching fixture contains a genuine empty result or provider failure
- **THEN** the recorded outcome is supplied unchanged as test input
- **AND** a recorded empty result remains distinct from a simulated `unavailable` error

### Requirement: Evaluation artifacts separate reports from execution errors

A workflow evaluation SHALL retain its actual ingestion report when available. Execution errors and scorer results SHALL remain separate. Saved results SHALL preserve case identity, repetition, provenance, check details, tool calls, and other case results. Saved errors SHALL remain bounded and exclude private exception content. Command exit status and experiment storage failures SHALL follow [Ingestion evaluation](../ingestion-evaluation/spec.md).

#### Scenario: The workflow returns a failed report

- **WHEN** a workflow returns a real report with a failed catalog outcome
- **THEN** evaluation retains and scores that report against its fixture expectations
- **AND** task execution success alone does not mark the case as passed

#### Scenario: Persistence fails with an available report

- **WHEN** run persistence fails and a real report is available
- **THEN** evaluation retains the report with the persistence failure and rejects the case

#### Scenario: A task fails without a report

- **WHEN** an evaluation task throws without an available ingestion report
- **THEN** the saved item has an execution error and no fabricated report
- **AND** valid sibling results remain in saved experiment items and the command exits nonzero

#### Scenario: A scorer fails

- **WHEN** a scorer fails or a required score is absent
- **THEN** the experiment retains available task output and scores without substituting success
- **AND** the command exits nonzero after the experiment completes

### Requirement: New executions share saved workflow history

New CLI and local or hosted Studio ingestion executions SHALL save workflow history by default for previews and apply runs on the selected host. Studio SHALL list and open that history without model credentials or an active catalog connection. History SHALL remain independent of logging and tracing. Reports created before this feature SHALL NOT be converted into workflow history.

#### Scenario: A CLI run is inspected later

- **WHEN** a CLI ingestion execution finishes with logging and tracing disabled and the owner later opens Studio with the same workflow store
- **THEN** the execution appears in recent runs with its available step results
- **AND** opening it makes no source requests, model requests, or catalog writes

#### Scenario: A batch targets several Events

- **WHEN** a CLI command starts ingestion for several Events
- **THEN** each execution has its own saved workflow entry and durable attempt association

#### Scenario: Earlier reports exist

- **WHEN** Studio opens a new workflow store beside a catalog with earlier ingestion reports
- **THEN** those reports remain in the catalog and do not appear as reconstructed workflow executions

### Requirement: Saved execution IDs identify the durable attempt

After initialization succeeds, saved execution data SHALL identify both the workflow execution and its durable ingestion attempt. Final summaries SHALL use those same IDs. Interrupted executions SHALL retain a saved association where available without claiming an unsaved result. Entries created before valid attempt initialization SHALL NOT claim a durable ingestion attempt.

#### Scenario: Work fails after initialization

- **WHEN** research fails or the owner cancels after the initialization result is saved
- **THEN** the available saved entry identifies the execution and durable attempt even if finalization has no saved summary

#### Scenario: The process stops during research

- **WHEN** the process stops after earlier steps were saved
- **THEN** inspection retains the last saved progress and does not infer completion from elapsed time

#### Scenario: Input is invalid

- **WHEN** execution creation is followed by rejected input
- **THEN** no durable ingestion attempt or external work starts
- **AND** any pending entry does not claim an ingestion run ID

### Requirement: Workflow history uses separate local storage

The owner SHALL be able to select a local workflow history file shared by CLI and Studio. The file SHALL be separate from the effective catalog, observability, and report files. A rejected file collision SHALL leave those files unchanged. Workflow history SHALL remain private to owner inspection on the selected host and SHALL NOT be served by the public website.

#### Scenario: CLI selects a custom catalog

- **WHEN** the owner selects a catalog through the CLI database option and configures workflow history to use that same file or its journal file
- **THEN** startup rejects the collision before opening workflow storage or starting external work

#### Scenario: Studio starts from another working directory

- **WHEN** Studio starts from another working directory
- **THEN** it opens the same configured workflow file as the CLI started from the project root

### Requirement: Workflow storage failures do not replay ingestion

Workflow history storage SHALL be required for execution. Failure before start SHALL prevent external work. A later failure SHALL stop execution with a safe history error and a nonzero CLI result. Calls that await execution SHALL receive that error. An early start response SHALL NOT certify execution completion or saved history. Confirmed catalog commits and durable reports SHALL remain unchanged. Storage failure SHALL NOT replay work. Optional observability SHALL keep its separate failure policy.

#### Scenario: Workflow storage cannot open

- **WHEN** a new execution cannot open or initialize its workflow store
- **THEN** no source requests, model requests, or catalog writes start
- **AND** the caller receives a bounded history-storage error without raw exception content

#### Scenario: A snapshot fails during research

- **WHEN** saving workflow progress fails after a durable attempt starts
- **THEN** calls that await execution receive a history-storage error with known IDs
- **AND** cleanup and failed report finalization use available attempt data without repeating research

#### Scenario: A final snapshot fails after a commit

- **WHEN** catalog writes and durable report finalization succeed but the final workflow snapshot fails
- **THEN** the CLI reports a history-storage failure and exits nonzero
- **AND** the committed data and completed report remain unchanged
- **AND** inspection does not claim that missing workflow history was saved

### Requirement: Saved history does not enable execution recovery

Saved ingestion executions SHALL support inspection only. Resume, restart, time travel, per-step execution, and automatic recovery SHALL remain unsupported. A new attempt SHALL use a fresh execution ID and current catalog state. Starting an execution that already started SHALL NOT repeat research or writes.

#### Scenario: Studio restarts after interruption

- **WHEN** Studio opens a store containing an interrupted execution
- **THEN** it exposes saved progress without restarting that execution
- **AND** an explicit new attempt gets a new execution ID

#### Scenario: An old ID is submitted to a start route

- **WHEN** a caller sends a start or stream request for an execution that already started
- **THEN** the HTTP request is rejected before a success response, a new durable attempt, or external work
- **AND** the saved execution remains unchanged

#### Scenario: The process stops before the first step snapshot

- **WHEN** an execution saves its start transition and then stops before the first step snapshot, either before or after durable attempt allocation
- **THEN** a later start with that ID is rejected without allocating a new durable attempt or starting external work
- **AND** the saved entry is not reset to pending

#### Scenario: The first snapshot after attempt allocation fails

- **WHEN** the first snapshot after durable attempt allocation fails and attempt recovery completes
- **THEN** reopening the store does not make the execution startable again
- **AND** a later start with that ID creates no new durable attempt or external work

#### Scenario: Saving the start transition fails

- **WHEN** the execution cannot confirm its saved start transition before attempt allocation
- **THEN** it reports a safe history-storage error without allocating an attempt or starting external work
- **AND** any transition that was saved remains marked as started

### Requirement: Removing workflow history preserves catalog records

Workflow snapshots SHALL remain until the owner deletes them. Deleting a saved execution or resetting the separate workflow store SHALL NOT delete catalog facts, audit records, durable ingestion reports, or observability records. Automatic age-based deletion SHALL remain outside this feature.

#### Scenario: The owner deletes a completed execution

- **WHEN** the owner deletes a completed execution through the workflow history API
- **THEN** it disappears from workflow history while its durable ingestion report and catalog records remain

#### Scenario: The owner resets the workflow store

- **WHEN** the owner stops its writers and Studio and removes only the workflow store and its journal files
- **THEN** the next start creates empty workflow history and leaves the other stores unchanged
