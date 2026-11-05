## MODIFIED Requirements

### Requirement: Submission preserves a fixed selection
The queue SHALL accept an ordered batch of 1 to 200 items for one operation. It SHALL validate the entire batch and save one job per item in one transaction. Each job SHALL keep its target, position, fixed settings, unique ID, and shared batch ID. Preview SHALL be the default and republish SHALL stay off. After commit, submission SHALL return only `batchId` and `acceptedCount` without waiting for research.

#### Scenario: Refresh targets
- **WHEN** the owner submits a refresh batch
- **THEN** every item must identify a distinct existing Event
- **AND** scope accepts current or full and defaults to full

#### Scenario: Add targets
- **WHEN** the owner submits three descriptions for add
- **THEN** each job keeps its nonblank text at its submitted position without an Event ID or refresh scope
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
Within the supported one-worker-per-catalog setup, the worker SHALL execute at most one background job at a time. Each execution SHALL run add or refresh for the stored target with fixed settings and current catalog facts. Ordinary processing failure SHALL permit later jobs. A done job SHALL mean processing ended, without implying ingestion success. Jobs SHALL store queue state and settings, not ingestion results or errors.

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

#### Scenario: An add job follows a failed job
- **WHEN** one add attempt fails and another item is pending
- **THEN** the processor can run the next item independently with its original description

#### Scenario: Add runs again after a commit
- **WHEN** a running add job restarts after an earlier attempt committed an Event
- **THEN** the fresh attempt checks current catalog state and can skip the existing Event
- **AND** both attempts remain associated with one job
