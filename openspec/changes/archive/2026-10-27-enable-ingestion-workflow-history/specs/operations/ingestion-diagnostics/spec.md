# Spec Delta

## MODIFIED Requirements

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
- **AND** native workflow success does not replace research status, editorial status, Location status, catalog outcome, or report persistence status

#### Scenario: A start request includes private request context

- **WHEN** a native start request carries separate credentials, prompts, source bodies, or provider payloads in request context
- **THEN** saved history excludes that request context while retaining allowed final model responses

## ADDED Requirements

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

After initialization succeeds, saved execution data SHALL identify both the workflow execution and its durable ingestion attempt. Final summaries SHALL use those same IDs. Interrupted executions SHALL retain a saved association where available without claiming an unsaved result. Native entries created before valid attempt initialization SHALL NOT claim a durable ingestion attempt.

#### Scenario: Work fails after initialization

- **WHEN** research fails or the owner cancels after the initialization result is saved
- **THEN** the available saved entry identifies the execution and durable attempt even if finalization has no saved summary

#### Scenario: The process stops during research

- **WHEN** the process stops after earlier steps were saved
- **THEN** inspection retains the last saved progress and does not infer completion from elapsed time

#### Scenario: Input is invalid

- **WHEN** native execution creation is followed by rejected input
- **THEN** no durable ingestion attempt or external work starts
- **AND** any native pending entry does not claim an ingestion run ID

### Requirement: Workflow history uses separate local storage

The owner SHALL be able to select a local workflow history file shared by CLI and Studio. The file SHALL be separate from the effective catalog, observability, and report files. A rejected file collision SHALL leave those files unchanged. Workflow history SHALL remain private to owner inspection on the selected host and SHALL NOT be served by the public website.

#### Scenario: CLI selects a custom catalog

- **WHEN** the owner selects a catalog through the CLI database option and configures workflow history to use that same file or its journal file
- **THEN** startup rejects the collision before opening workflow storage or starting external work

#### Scenario: Studio changes its build working directory

- **WHEN** the Studio launcher starts its generated server from another working directory
- **THEN** it opens the same configured workflow file as the CLI started from the project root

### Requirement: Workflow storage failures do not replay ingestion

Workflow history storage SHALL be required for execution. Failure before start SHALL prevent external work. A later failure SHALL stop execution with a safe history error and a nonzero CLI result. Calls that await execution SHALL receive that error. An early native start response SHALL NOT certify execution completion or saved history. The system SHALL preserve confirmed catalog commits and durable reports, attempt normal cleanup and unfinished report finalization where possible, and SHALL NOT replay work. Optional logs, traces, and metrics SHALL keep their existing failure policy.

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

- **WHEN** the owner deletes a completed execution through the native workflow history API
- **THEN** it disappears from workflow history while its durable ingestion report and catalog records remain

#### Scenario: The owner resets the workflow store

- **WHEN** the owner stops its writers and Studio and removes only the workflow store and its journal files
- **THEN** the next start creates empty workflow history and leaves the other stores unchanged
