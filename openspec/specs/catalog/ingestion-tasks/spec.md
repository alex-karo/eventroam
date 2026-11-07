# Ingestion tasks

## Purpose

Let the owner submit durable add and Event refresh jobs and inspect their execution separately from saved ingestion evidence.

## Requirements

### Requirement: Submission preserves a fixed selection
The queue SHALL accept an ordered batch of 1 to 200 items for one operation. It SHALL validate the entire batch and save one job per item in one transaction. Each job SHALL keep its explicit mode, target input, position, fixed settings, unique ID, and shared batch ID. Preview SHALL be the default and republish SHALL stay off. After commit, submission SHALL return only `batchId` and `acceptedCount` without waiting for research.

#### Scenario: Refresh targets
- **WHEN** the owner submits a refresh batch
- **THEN** each job has mode `refresh` and a JSON object with a distinct existing Event ID and scope
- **AND** scope accepts current or full and defaults to full

#### Scenario: Add targets
- **WHEN** the owner submits three descriptions for add
- **THEN** each job has mode `add` and keeps its full nonblank text as a JSON string at its submitted position
- **AND** each attempt links to its job even if no Event is created

#### Scenario: Submit a country selection
- **WHEN** the owner requests apply for 67 resolved Event IDs from France and submission succeeds
- **THEN** acceptance returns the batch ID and acceptedCount 67
- **AND** catalog SQL provides individual job and Event IDs
- **AND** later catalog changes do not add Events to that batch

#### Scenario: Submission fails
- **WHEN** the complete selection cannot be accepted
- **THEN** none of its jobs are accepted
- **AND** no attempt starts for that selection

#### Scenario: Submission response is lost
- **WHEN** the selection is accepted but its response is not delivered
- **THEN** the jobs remain accepted and their batch can be found through read-only catalog SQL without logs
- **AND** the system does not automatically submit again

#### Scenario: Invalid selection
- **WHEN** a batch is empty, has more than 200 items, contains a blank add description, or includes a duplicate or missing refresh Event ID
- **THEN** no jobs or attempts are created

### Requirement: The worker processes jobs sequentially
Within the supported one-Studio-server-per-catalog setup, the worker SHALL execute at most one background job at a time. Each execution SHALL select the operation from the stored mode, validate its input, and run the operation with fixed settings and current catalog facts. Ordinary processing failure SHALL permit later jobs. A done job SHALL mean processing ended, without implying ingestion success. Jobs SHALL store queue state and settings, not ingestion results or errors.

#### Scenario: Target changes before execution
- **WHEN** a selected Event changes before its job starts
- **THEN** the attempt reads current facts

#### Scenario: Ingestion fails
- **WHEN** a job's workflow ends with an ingestion failure
- **THEN** the job becomes done and later pending jobs remain eligible
- **AND** available ingestion results remain in runs, not the job

#### Scenario: Validation fails before an attempt
- **WHEN** processing cannot validate the mode, its input, or required credentials
- **THEN** no external work starts and the job becomes done without an invented run

#### Scenario: An add job follows a failed job
- **WHEN** one add attempt fails and another item is pending
- **THEN** the processor can run the next item independently with its original description

#### Scenario: Add runs again after a commit
- **WHEN** a running add job restarts after an earlier attempt committed an Event
- **THEN** the fresh attempt checks current catalog state and can skip the existing Event
- **AND** both attempts remain associated with one job

### Requirement: Queue persistence failures stop further processing
If the final queue state cannot be saved, no further background job SHALL start. Saved attempts, reports, and catalog commits SHALL remain available. A job left running SHALL be processed again after Studio restarts under the restart contract.

#### Scenario: Done state cannot be saved
- **WHEN** an attempt finishes but its job cannot be marked done
- **THEN** no further background job starts
- **AND** saved attempt evidence and commits remain available

### Requirement: Accepted jobs survive the chat request
Request abort observed before submission SHALL prevent acceptance. It SHALL NOT cancel accepted jobs. On Studio restart, the queue SHALL treat saved running jobs as unprocessed and execute them and pending jobs from the beginning. Each execution SHALL read current catalog facts and use a fresh run ID if it reaches attempt creation. Done and cancelled jobs SHALL remain unchanged. Earlier reports and commits SHALL remain available, including when research is repeated.

#### Scenario: Worker restarts during a batch
- **WHEN** Studio stops with one running job and other pending jobs
- **THEN** all unprocessed jobs run after restart
- **AND** the old running job starts from the beginning with a new attempt ID

#### Scenario: Stop precedes attempt creation
- **WHEN** Studio stops after a job becomes running but before its attempt is recorded
- **THEN** restart processes the job from the beginning

#### Scenario: Run finalized before job completion
- **WHEN** an attempt finalized but the job remained running before restart
- **THEN** the job runs again with a new attempt
- **AND** the earlier final report and committed changes remain available

### Requirement: Cancellation changes only pending jobs
Explicit batch cancellation SHALL cancel eligible pending jobs together. A job that starts before cancellation takes effect SHALL continue. Running and terminal jobs SHALL remain unchanged. Cancellation failure SHALL NOT be reported as success.

#### Scenario: Cancel while an Event runs
- **WHEN** the owner cancels a batch with one running job and five pending jobs before those five start
- **THEN** the five become cancelled and do not execute
- **AND** the active attempt continues

#### Scenario: Cancel after an interruption
- **WHEN** the owner cancels a batch with pending jobs and an interrupted running job before its new execution starts
- **THEN** the pending jobs become cancelled
- **AND** the running job remains eligible for fresh execution

### Requirement: Job inspection is bounded and separate from reports
Queue status, mode, JSON input, fixed settings, and all associated run IDs SHALL be readable through catalog SQL with its existing output limits. Detailed reports SHALL remain in ingestion_runs. Jobs SHALL remain private and stored with catalog history without automatic expiry in this version.

#### Scenario: Inspect a batch by ID
- **WHEN** the owner asks for a batch's status or item details
- **THEN** the catalog assistant can use SQL queries for counts and details
- **AND** the details show Event ID and scope for refresh or a short note excerpt for add

#### Scenario: A job has several attempts
- **WHEN** a job was processed more than once after restart
- **THEN** SQL reads expose each attempt and available report
- **AND** queue counts still count the job once

### Requirement: Inspection does not require processing credentials
Missing ingestion credentials SHALL NOT prevent stored job or workflow inspection. Missing catalog storage SHALL produce a safe job-storage error without creating or migrating a catalog. Background jobs SHALL NOT start when catalog storage is unavailable. Submission SHALL need catalog access but not an active queue or ingestion credentials.

#### Scenario: Submit without ingestion credentials in Studio
- **WHEN** valid submission reaches Studio without ingestion credentials
- **THEN** the complete selection is accepted if catalog storage is available
- **AND** the queue uses the ingestion configuration when it processes the jobs

#### Scenario: Open Studio without model credentials
- **WHEN** Studio opens without ingestion credentials
- **THEN** stored job and workflow history remain inspectable when their stores are available
- **AND** inspection starts no research

### Requirement: Shutdown preserves accepted work and evidence
Studio shutdown SHALL start no further jobs and stop active background work before shutdown completes. It SHALL preserve saved run evidence and commits and leave a shutdown-interrupted job unprocessed for the next restart.

#### Scenario: Worker shuts down during ingestion
- **WHEN** Studio begins shutdown with an active job
- **THEN** no further job starts
- **AND** active work stops without removing saved commits or run evidence
- **AND** its job remains eligible for fresh execution after restart

### Requirement: Studio processes the saved queue
Studio SHALL process accepted jobs in its own process. The queue SHALL read saved jobs after Studio starts.

#### Scenario: Studio starts after an interruption
- **WHEN** Studio starts with saved pending or running jobs
- **THEN** the queue processes those jobs from the beginning
