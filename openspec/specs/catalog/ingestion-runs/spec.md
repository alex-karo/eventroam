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

Each final report MUST identify attempt, mode, scope, source-check and validation outcomes, place-check status, and catalog outcome. It MUST retain checks, questions, errors, known IDs, and the frozen date. Success MUST NOT certify complete checks. Catalog outcomes MUST distinguish created, updated, published, unchanged, skipped, and failed. Saved counts MUST describe catalog context; returned counts MUST count selected non-null Edition roles.

#### Scenario: A completed recheck changes nothing

- **WHEN** refresh confirms accepted facts without a change
- **THEN** the report identifies completed research and an unchanged catalog outcome

#### Scenario: Usable collection ends in an identity refusal

- **WHEN** source collection produces usable findings but Event identity cannot be confirmed
- **THEN** the report retains `researchStatus: partial` and `outcome: failed`
- **AND** the run makes no catalog changes and retains the findings and refusal reason

#### Scenario: Reports retain the two-slot contract

- **WHEN** add or refresh returns its final result
- **THEN** the report retains the named Edition slots in the result
- **AND** add reports the same frozen `currentDate` used throughout the run
- **AND** saved context and selected findings have separate counts

#### Scenario: Location is not required

- **WHEN** no Edition slots are selected or the run skips duplicate add
- **THEN** the report records locationStatus as not_run without inventing a place-check response

#### Scenario: The historical slot has ticket facts in its source

- **WHEN** only historical ticket evidence is available
- **THEN** the report does not claim that historical prices or links were audited
- **AND** a missing current-or-next slot does not substitute historical ticket work

### Requirement: Reports retain findings and changes

Previews and writes SHALL show old and new values with reasons. Applied changes SHALL match audit. A write failure SHALL retain prepared operations, available results, and its error with no applied changes. Reports SHALL distinguish source findings, accepted updates, and place decisions. Saved sources SHALL remain private artifacts rather than separately attached report bodies. No-op decisions SHALL NOT claim fresh verification.

#### Scenario: Research and editorial responses are available

- **WHEN** execution produces final text and structured output
- **THEN** the private report retains available final responses without content filtering and distinguishes findings from accepted updates

#### Scenario: Research succeeds but writing fails

- **WHEN** a valid proposed update fails the catalog writer
- **THEN** the report retains research status, findings, prepared operations, and available model responses with the write-stage error
- **AND** applied `changes` is empty and a separate proposed diff is not required

#### Scenario: A source cannot be fetched

- **WHEN** a source read fails and no update is supported
- **THEN** its URL, UTC check time, and failure outcome remain visible without changing catalog facts

#### Scenario: Location uses a historical point

- **WHEN** an Edition inherits coordinates
- **THEN** the report identifies the earlier saved Edition, its version, copied point and precision, the decision reason, and available distance comparison

#### Scenario: Location rejects after usable research

- **WHEN** a required place check finds a material identity conflict
- **THEN** the report retains available findings and place-check results with no applied changes and does not invent unavailable responses
- **AND** locationStatus is rejected and a location_rejected diagnostic retains the supplied reason
- **AND** the attempt outcome is failed while the successful research status is preserved

#### Scenario: Location starts with shared geocoding context

- **WHEN** initial reverse results serve both selected slots
- **THEN** the report retains bounded request direction, safe input and result metadata, and the associated slot references
- **AND** initial requests remain distinct from actual tool calls without fabricated tool calls or model usage
- **AND** reverse observations identify nearby context without presenting returned coordinates as replacement candidates

### Requirement: Output matches the stored final report

Studio and local run inspection SHALL use the same stored final report for a completed attempt. CLI output for a completed attempt SHALL show a summary that identifies the saved report and the workflow run.

#### Scenario: JSON output is requested

- **WHEN** an attempt finishes and the owner requests JSON output
- **THEN** the CLI returns the workflow summary with the attempt outcome, diagnostic codes, and both run IDs
- **AND** the ingestion run ID identifies the saved final report

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

Reports SHALL distinguish model_failed, invalid_candidate, and limit_reached with the failed boundary and safe diagnostics. Budget exhaustion SHALL take precedence when a model failure occurs at the limit. Existing place-check diagnostics SHALL remain available. Required source-storage failures SHALL have a safe persistence diagnostic. Missing details SHALL NOT be invented.

#### Scenario: Provider fails before a candidate

- **WHEN** a model request fails without a usable final result and the research budget is not exhausted
- **THEN** the run reports `model_failed` with available safe error details

#### Scenario: Returned candidate is malformed

- **WHEN** a source URL is malformed or the final candidate still contains a malformed official-link URL after any permitted return
- **THEN** the run reports `invalid_candidate`, retains the returned result and source-read history privately, and makes no catalog changes

#### Scenario: Research budget is exhausted

- **WHEN** research reaches its step or time limit without a valid result
- **THEN** the run reports `limit_reached` with a limit reason, source-read history, and available model questions
- **AND** it does not require or invent a complete list of unfinished checks

#### Scenario: A required result has an invalid reference

- **WHEN** a proposed ticket price cites an evidence reference that does not exist
- **THEN** the report identifies the validation failure and no item changes are applied
- **AND** valid earlier responses remain available for inspection

### Requirement: Run persistence failures do not replay work
Failure to create the running record SHALL stop the attempt before research or mutation. Failure to save final status and report SHALL yield a safe persistence error and nonzero result, correlated by run ID where available. It SHALL leave the run record unfinished and SHALL NOT replay research, undo confirmed catalog commits, or claim durable finalization.

#### Scenario: Start cannot be saved
- **WHEN** the running record cannot be persisted
- **THEN** no source, model, or catalog work starts for that attempt

#### Scenario: Finalization fails after apply
- **WHEN** catalog changes commit but the final run update fails
- **THEN** the command reports persistence failure with the run ID, the changes remain committed, and the run record remains unfinished

### Requirement: Core statistics are queryable with run history

Run records SHALL expose duration with identity, status, and report history. A finalized record's duration SHALL match its report. Run records SHALL NOT duplicate token counts, cost estimates, or accounting-completeness fields. Those metrics SHALL be inspected through optional observability. An unfinished attempt SHALL leave final duration, finish time, and report absent.

#### Scenario: A run finalizes with incomplete usage

- **WHEN** a run finalizes while available model metrics are incomplete
- **THEN** its duration and final report remain available without token or cost statistics in run history

#### Scenario: A run remains unfinished

- **WHEN** finalization fails or the attempt is interrupted
- **THEN** its final duration, finish time, and report remain absent

### Requirement: Run history remains private and bounded

Stored inputs SHALL contain normalized operation settings and safe configuration metadata. Reports SHALL retain available final model responses without content filtering, even when they repeat prompt or public source text. Public source URLs SHALL retain their components within existing field length limits. The application SHALL NOT scan model responses or public source URLs for secrets or redact their content. It SHALL NOT separately copy application or SDK credentials, environment dumps, prompts, full source bodies, headers, provider transport payloads, or raw exceptions into reports. These field exclusions SHALL NOT override model-response preservation. Run records SHALL NOT be exposed through public website reads.

#### Scenario: A provider error contains sensitive content
- **WHEN** a caught exception contains request or response content
- **THEN** the persisted error uses available recognized type, HTTP status, provider or network code, and retryability within bounded safe fields without that raw content

#### Scenario: Research reads a page
- **WHEN** ingestion uses saved source text
- **THEN** the private report retains the source description and available final responses
- **AND** saved execution results identify the private source artifacts
- **AND** text repeated by the model remains, but the application does not attach the page body or prompt separately

#### Scenario: Full Markdown is required for later validation

- **WHEN** ingestion processes a retrieved source
- **THEN** its full parsed Markdown is stored in the separate private corpus
- **AND** saved execution results reference that artifact without attaching the full body again
- **AND** the report keeps its existing source descriptions and format
- **AND** optional tracing does not control required corpus storage

### Requirement: Classification count errors identify the conflict

If a classification list still has excess facet terms after its permitted return, preparation MUST report `code:invalid_plan`, `stage:validation`, and the classification field path. Its message MUST identify the facet, limit, and conflicting IDs. The item MUST have no catalog operations. A recovered count error MUST appear in the repair record without appearing as a final error.

#### Scenario: An accepted classification has two event types

- **WHEN** Classification uses its return and still proposes both `festival` and `gathering`
- **THEN** the error identifies the Edition slot's classification field, `event_type`, a limit of one, and both term IDs

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

### Requirement: Background attempts retain job identity
Each background attempt SHALL save its trusted job ID before source, model, or catalog work. A job SHALL support several attempts with distinct run IDs after the worker restarts. Earlier attempts SHALL remain unchanged and readable. Direct CLI and Studio form attempts SHALL require no job ID. Job association SHALL NOT change report version or attempt lifecycle.

#### Scenario: Start a background attempt
- **WHEN** a job starts ingestion
- **THEN** its new running attempt and job association are saved together before research

#### Scenario: Job runs again after restart
- **WHEN** a saved running job is processed again after the worker restarts
- **THEN** it gets a new attempt ID with the same job ID
- **AND** earlier attempts and available reports remain unchanged

#### Scenario: Attempt cannot be saved
- **WHEN** attempt creation or job association cannot be persisted
- **THEN** no external work starts for that execution

#### Scenario: Run ingestion directly
- **WHEN** the owner starts ingestion through the CLI or Studio form
- **THEN** normal attempt history requires no job ID

### Requirement: Reports show how a proposal was repaired

The private report SHALL identify the target and group for each repair. It SHALL show the available original and revised proposals or omissions, who requested the repair, the return note with any source excerpts and references, any existing evidence the revision cites, and the decision and outcome. It SHALL distinguish a recovered issue from a final failure and a proposal from a write. The full specialist conversation SHALL stay out of the report and saved workflow history.

#### Scenario: The owner opens a repaired preview after the attempt ends

- **WHEN** a preview with tracing off repairs a link after Editor returns it to Links and repairs an invalid ticket group after validation returns it to Tickets
- **AND** the owner opens the report in Studio after the process exits
- **THEN** the report shows both repairs with their values, return notes, any available source excerpts, and final decisions
- **AND** it attributes the ticket return to validation and shows the field error as recovered

#### Scenario: A repaired website shares a check with an unresolved social link

- **WHEN** a full refresh corrects the Event website while a social link in the same check and an unrelated source gap remain open
- **THEN** the report shows the website correction and keeps the broader check unfinished
- **AND** the social link question and source gap remain visible

#### Scenario: Repair stops before there is a final answer

- **WHEN** a requested revision fails before a valid reply or before final review
- **THEN** the report retains the available original proposal, request and failure
- **AND** it does not claim approval or a catalog write
