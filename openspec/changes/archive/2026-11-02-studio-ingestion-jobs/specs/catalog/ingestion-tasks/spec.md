# Spec Delta

## Purpose

Let the owner submit durable Event refresh jobs and inspect their execution separately from saved ingestion evidence.

## ADDED Requirements

### Requirement: Submission preserves a fixed selection
The system SHALL validate one to 200 distinct existing Event IDs and accept the complete selection or none of it. Each accepted Event SHALL have one job with fixed settings, a unique ID, and a shared batch ID. Scope SHALL default to full and accept current or full. dryRun SHALL default to true and republish SHALL remain off. Submission SHALL return only the batch ID and accepted count after durable acceptance without waiting for research.

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
- **WHEN** input contains duplicate IDs, missing Events, or more than 200 IDs
- **THEN** no jobs or attempts are created

### Requirement: The worker processes jobs sequentially
Within the supported one-worker-per-catalog setup, the worker SHALL execute at most one background job at a time. Each execution SHALL refresh its Event with fixed settings and current catalog facts. Ordinary processing failure SHALL permit later jobs. A done job SHALL mean processing ended, without implying ingestion success. Jobs SHALL store queue state and settings, not ingestion results or errors.

#### Scenario: Target changes before execution
- **WHEN** a selected Event changes before its job starts
- **THEN** the attempt reads current facts

#### Scenario: Ingestion fails
- **WHEN** a job's workflow ends with an ingestion failure
- **THEN** the job becomes done and later pending jobs remain eligible
- **AND** available ingestion results remain in runs, not the job

#### Scenario: Validation fails before an attempt
- **WHEN** processing cannot validate the target or required credentials
- **THEN** no external work starts and the job becomes done without an invented run

### Requirement: Job execution is independent of Studio
Accepted jobs SHALL be processed by a separate worker. Studio shutdown or restart SHALL NOT stop an active job or reset its queue state. Submission, progress reads, and pending cancellation SHALL remain available while the worker is stopped.

#### Scenario: Studio restarts during ingestion
- **WHEN** Studio restarts while the worker is processing a job
- **THEN** the worker continues that execution
- **AND** Studio does not reset or repeat the job

#### Scenario: Submit while the worker is stopped
- **WHEN** the owner submits a valid selection with the worker stopped
- **THEN** the jobs remain pending and inspectable
- **AND** the worker processes them when it starts

### Requirement: Queue persistence failures stop further processing
If the final queue state cannot be saved, no further background job SHALL start. Saved attempts, reports, and catalog commits SHALL remain available. A job left running SHALL be processed again after restart under the restart contract.

#### Scenario: Done state cannot be saved
- **WHEN** an attempt finishes but its job cannot be marked done
- **THEN** no further background job starts
- **AND** saved attempt evidence and commits remain available

### Requirement: Accepted jobs survive the chat request
Request abort observed before submission SHALL prevent acceptance. It SHALL NOT cancel accepted jobs. On worker restart, the worker SHALL treat saved running jobs as unprocessed and execute them and pending jobs from the beginning. Each execution SHALL read current catalog facts and use a fresh run ID if it reaches attempt creation. Done and cancelled jobs SHALL remain unchanged. Earlier reports and commits SHALL remain available, including when research is repeated.

#### Scenario: Worker restarts during a batch
- **WHEN** the worker stops with one running job and other pending jobs
- **THEN** all unprocessed jobs run after restart
- **AND** the old running job starts from the beginning with a new attempt ID

#### Scenario: Stop precedes attempt creation
- **WHEN** the worker stops after a job becomes running but before its attempt is recorded
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
Queue status, Event IDs, fixed settings, and all associated run IDs SHALL be readable through catalog SQL with its existing output limits. Detailed reports SHALL remain in ingestion_runs. Jobs SHALL remain private and stored with catalog history without automatic expiry in this version.

#### Scenario: A job has several attempts
- **WHEN** a job was processed more than once after restart
- **THEN** SQL reads expose each attempt and available report
- **AND** queue counts still count the job once

### Requirement: Inspection does not require processing credentials
Missing ingestion credentials SHALL NOT prevent stored job or workflow inspection. Missing catalog storage SHALL produce a safe job-storage error without creating or migrating a catalog. Background jobs SHALL NOT start when catalog storage is unavailable. Submission SHALL need catalog access but not worker availability or ingestion credentials.

#### Scenario: Submit without ingestion credentials in Studio
- **WHEN** valid submission reaches Studio without ingestion credentials
- **THEN** the complete selection is accepted if catalog storage is available
- **AND** the worker uses its own configuration when it processes the jobs

#### Scenario: Open Studio without model credentials
- **WHEN** Studio opens without ingestion credentials
- **THEN** stored job and workflow history remain inspectable when their stores are available
- **AND** inspection starts no research

### Requirement: Shutdown preserves accepted work and evidence
Worker shutdown SHALL start no further jobs and stop active background work before shutdown completes. It SHALL preserve saved run evidence and commits and leave a shutdown-interrupted job unprocessed for the next restart.

#### Scenario: Worker shuts down during ingestion
- **WHEN** the worker begins shutdown with an active job
- **THEN** no further job starts
- **AND** active work stops without removing saved commits or run evidence
- **AND** its job remains eligible for fresh execution after restart
