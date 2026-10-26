# Spec Delta

## MODIFIED Requirements

### Requirement: Reports distinguish work and outcome

Each final report MUST identify attempt, mode, scope, research, editorial and Location statuses, and catalog outcome. It MUST include source checks, questions, errors, known IDs, and the frozen date. Success MUST describe the operation without certifying complete checks. Outcomes MUST distinguish created, updated, published, unchanged, skipped, and failed. Saved counts MUST describe catalog context; returned counts MUST count non-null research slots.

#### Scenario: A completed recheck changes nothing

- **WHEN** refresh confirms accepted facts without a change
- **THEN** the report identifies completed research and an unchanged catalog outcome

#### Scenario: Reports retain the two-slot contract

- **WHEN** add or refresh returns final research or editorial output
- **THEN** the report retains the named Edition slots in the separate raw responses
- **AND** add reports the same frozen `currentDate` used by research and editing
- **AND** saved context and selected findings have separate counts

#### Scenario: Location is not required

- **WHEN** the editor accepts no Edition slots or the run skips duplicate add
- **THEN** the report records locationStatus as not_run without inventing a Location response

### Requirement: Reports retain findings and changes

Previews and writes SHALL show old and new values with reasons. Applied changes SHALL match audit. A write failure SHALL retain prepared operations, available final agent responses, and its error; applied changes SHALL stay empty. Research, editor, and Location responses SHALL remain separate. Reports SHALL retain supplied source summaries and bounded Location candidate and donor references without requiring source citations in Location output. No-op decisions SHALL remain visible without claiming verification. Outcome SHALL NOT imply research completeness.

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

#### Scenario: Location uses a historical point

- **WHEN** an Edition inherits coordinates
- **THEN** the report identifies the donor, its version, copied point and precision, the decision reason, and available distance comparison

#### Scenario: Location rejects after usable research

- **WHEN** Location rejects a material identity conflict
- **THEN** the report retains the separate research, editor, and Location responses with no applied changes
- **AND** locationStatus is rejected and a location_rejected diagnostic retains the supplied reason
- **AND** the attempt outcome is failed while the successful research status is preserved

#### Scenario: Location starts with shared geocoding context

- **WHEN** initial forward or reverse results serve both accepted slots
- **THEN** the report retains bounded request direction, safe input and result metadata, and the associated slot references
- **AND** initial requests remain distinct from actual agent tool calls without fabricated tool calls or model usage
- **AND** reverse observations identify nearby context without presenting returned coordinates as replacement candidates

### Requirement: Report consumers reject unsupported versions

The current report contract SHALL use version 7. Consumers SHALL reject unsupported versions explicitly.

#### Scenario: An unsupported report version is read

- **WHEN** a consumer receives a report version it does not support
- **THEN** it rejects that version explicitly without silently converting or filling gaps

#### Scenario: Historical reports remain unchanged

- **WHEN** the active contract changes from version 6 to version 7
- **THEN** newly generated reports use version 7 and stored historical report JSON remains unchanged
- **AND** consumers do not convert or fill gaps in unsupported reports

### Requirement: Command results reflect attempt failures

Failed research, editing, required Location, writing, or persistence SHALL produce a nonzero command result. Partial research or a valid Location result with unresolved questions alone SHALL NOT.

#### Scenario: Duplicate add is skipped

- **WHEN** add recognizes an existing Event without a host failure
- **THEN** it reports skipped and exits zero without catalog writes

#### Scenario: New Event creation is declined

- **WHEN** add produces usable research but concludes there is insufficient support to create a new Event
- **THEN** it reports skipped with the reason, exits zero, and makes no catalog or publication writes

#### Scenario: Location fails technically

- **WHEN** a required Location model call fails without a valid final plan
- **THEN** the command exits nonzero and makes no catalog or publication writes

### Requirement: Finalization reflects success and failure accurately

A non-failed catalog outcome without unexpected host failure SHALL complete its lifecycle, including previews, unchanged checks, skipped duplicates, and useful partial results. Research, editorial, required Location, validation, or writer failure SHALL finalize as failed with available diagnostics. Unexpected errors SHALL preserve known committed outcomes and safe failure details without inventing missing details. Usage metrics SHALL remain separate under the optional observability contract.

#### Scenario: Partial research has a safe no-op

- **WHEN** research is partial but the catalog outcome is unchanged and no host failure occurs
- **THEN** the attempt completes while its report retains the unfinished questions

#### Scenario: Unexpected failure follows a commit

- **WHEN** a host error occurs after a catalog item commits
- **THEN** the report retains that known commit and safe failure details without claiming the whole run succeeded

### Requirement: Failure codes identify the failed boundary

The final report SHALL distinguish a model request failure before usable output as `model_failed`, a structurally invalid returned candidate as `invalid_candidate`, and research budget exhaustion as `limit_reached`. Budget exhaustion SHALL retain precedence when a model failure also occurs at the limit. Each code SHALL retain available safe diagnostics without inventing missing details. Usage metrics SHALL follow the optional observability contract.

#### Scenario: Provider fails before a candidate

- **WHEN** a model request fails without a usable final result and the research budget is not exhausted
- **THEN** the run reports `model_failed` with available safe error details

#### Scenario: Returned candidate is malformed

- **WHEN** a returned candidate contains a malformed source or official-link URL
- **THEN** the run reports `invalid_candidate`, retains the returned result and source-read history privately, and makes no catalog changes

#### Scenario: Research budget is exhausted

- **WHEN** research reaches its step or time limit without a valid result
- **THEN** the run reports `limit_reached` with a limit reason, source-read history, and available model questions
- **AND** it does not require or invent a complete list of unfinished checks

### Requirement: Core statistics are queryable with run history

Run records SHALL expose duration with identity, status, and report history. A finalized record's duration SHALL match its report. Run records SHALL NOT duplicate token counts, cost estimates, or accounting-completeness fields. Those metrics SHALL be inspected through optional observability. An unfinished attempt SHALL leave final duration, finish time, and report absent.

#### Scenario: A run finalizes with incomplete usage

- **WHEN** a run finalizes while available model metrics are incomplete
- **THEN** its duration and final report remain available without token or cost statistics in run history

#### Scenario: A run remains unfinished

- **WHEN** finalization fails or the attempt is interrupted
- **THEN** its final duration, finish time, and report remain absent

## ADDED Requirements

### Requirement: Reports link to optional execution metrics

Final reports SHALL retain duration, budget settings and execution counters, selected stage models, and a real trace ID when available. They SHALL NOT maintain a separate token or cost summary. Geocoding observations SHALL remain available without claiming billed cost. Missing metrics SHALL NOT prevent report finalization.

#### Scenario: A later call fails

- **WHEN** a model call fails after earlier work
- **THEN** the report retains available decisions, safe failure details, and trace correlation without constructing a partial spending summary

#### Scenario: Tracing is disabled

- **WHEN** the owner runs ingestion without tracing
- **THEN** its report can finalize without a trace ID or token and cost fields
- **AND** it does not substitute zero for missing metrics

#### Scenario: Evaluation prohibits web search

- **WHEN** an evaluation case checks that research did not search and tracing is disabled
- **THEN** the saved budget counters still let the scorer check that policy

#### Scenario: Location uses a different model

- **WHEN** Location runs with a model different from research and editing
- **THEN** the report identifies its model and available trace correlation
- **AND** model usage is inspected in observability without report totals

#### Scenario: A provider URL contains authentication

- **WHEN** a geocoding request is made
- **THEN** the report records safe query and candidate metadata without the authenticated URL, key, headers, or transport payload

## REMOVED Requirements

### Requirement: Usage reports retain known accounting limits

**Reason**: Token and cost inspection uses optional observability. Reports no longer maintain a separate accounting system.

**Migration**: Version 7 omits the usage summary. Consumers inspect available metrics through run and trace correlation. Stored historical report JSON remains unchanged; current consumers reject unsupported versions.
