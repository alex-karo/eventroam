# Spec Delta

## MODIFIED Requirements

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
- **THEN** ingestion keeps its original result and emits a bounded content-free diagnostic

#### Scenario: Another process owns observability storage

- **WHEN** another process prevents opening the local store
- **THEN** ingestion continues with a bounded diagnostic without taking ownership from that process

#### Scenario: A preview has tracing enabled

- **WHEN** the owner enables tracing for a dry-run
- **THEN** available observations persist separately from the catalog
- **AND** the preview retains no catalog record, version, audit, or receipt changes

#### Scenario: An evaluation uses injected tools

- **WHEN** tracing is enabled for an evaluation case with injected tools or model responses
- **THEN** available observations retain case and execution correlation
- **AND** mocked calls do not invent token usage or costs

### Requirement: Studio inspection exposes execution progress

Local or hosted Studio SHALL expose the flow, progress, execution ID, run ID, and available research, editorial, Location, geocoding, source, catalog, and report outcomes. Opening inspection SHALL NOT start work or require model credentials. Execution state SHALL exclude credentials, authenticated provider URLs, prompts, full page bodies, transport payloads, live resources, and raw exceptions. Final model responses SHALL follow ingestion-run rules. Concurrent attempts SHALL remain distinct.

#### Scenario: Open Studio without execution prerequisites

- **WHEN** the owner opens the ingestion view without model credentials
- **THEN** the flow and saved observations are inspectable without starting a run

#### Scenario: Inspect a failed attempt

- **WHEN** an attempt fails after returning research findings
- **THEN** Studio exposes available phase outcomes, model responses, and the failure stage without separately attaching page bodies or provider payloads

#### Scenario: An active execution ID is reused

- **WHEN** a caller supplies an execution ID already in use
- **THEN** Studio rejects that execution before work without affecting the original attempt

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
- **THEN** the run keeps its original result and a content-free diagnostic is available

#### Scenario: Location has geocoding failures

- **WHEN** Location completes technically after a geocoding error
- **THEN** inspection distinguishes the provider error, the Location execution result, and the final catalog outcome
- **AND** it does not expose the authenticated request URL

#### Scenario: Initial geocoding precedes the model

- **WHEN** Location context preparation makes forward or reverse requests
- **THEN** inspection identifies these requests separately from later agent tool calls
- **AND** no model generation or usage is invented for preparation

## ADDED Requirements

### Requirement: Location evaluation separates completion correction and preservation

Location evaluation SHALL report missing-point completion, known-error correction, and correct-old-point preservation as separate case groups. It SHALL use the existing assertions and scores. Completion and correction cases SHALL require the expected point or precision change, so keeping every point SHALL NOT pass them. Preservation cases SHALL reject unwanted changes. Group results SHALL NOT claim an accuracy percentage or an untested quality guarantee.

#### Scenario: A plan keeps every point

- **WHEN** the evaluated agent returns keep for cases that require completion or correction
- **THEN** those cases fail their change assertions even if preservation cases pass

#### Scenario: A correct old point is changed

- **WHEN** a preservation case produces an unwanted point or precision change
- **THEN** the preservation case fails independently of completion and correction results

### Requirement: Location evaluation uses captured geocoding

Isolated Location evaluation SHALL use real preparation and execution with captured, normalized forward and reverse geocoding-client results, without live fallback. An unmatched initial or agent request SHALL return bounded fixture_miss and fail its case even after a valid plan. The artifact SHALL retain available output, observations, actual tool calls, errors, scores, and valid siblings without a fabricated ingestion report. The command SHALL save it before exiting nonzero for failed cases.

#### Scenario: An initial reverse fixture is missing

- **WHEN** initial preparation requests a reverse response absent from the fixture
- **THEN** the case retains a fixture_miss observation and fails without a live request
- **AND** available later Location output and valid sibling results remain in the saved artifact

#### Scenario: The agent requests an uncaptured spelling

- **WHEN** an agent forward request has no matching fixture but a later decision is valid
- **THEN** the case still fails and retains the tool error and available decision

#### Scenario: The captured provider returns no match

- **WHEN** a matching fixture contains a genuine empty result or provider failure
- **THEN** the recorded outcome is supplied as test input rather than classified as fixture_miss

### Requirement: Evaluation artifacts separate reports from execution errors

A completed ingestion workflow evaluation SHALL retain one real ingestion report per available task output, without flat report copies. Execution errors and scorer results SHALL remain separate. The artifact SHALL preserve case identity, repetition, provenance, assertion details, tool calls, and valid sibling results. The command SHALL exit nonzero for task or scorer errors, missing required scores, or failed cases. Saved errors SHALL follow the existing bounded safe-error rules.

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
- **AND** valid sibling results remain in the completed artifact and the command exits nonzero

#### Scenario: A scorer fails

- **WHEN** a scorer fails or a required score is absent
- **THEN** the completed artifact retains available task output and scores without substituting success
- **AND** the command exits nonzero after writing the artifact
