## MODIFIED Requirements

### Requirement: Finalization reflects success and failure accurately

A non-failed catalog outcome without unexpected host failure SHALL complete its lifecycle, including previews, unchanged checks, skipped duplicates, and useful partial results. Required processing, validation, storage, or writer failure SHALL finalize as failed with available diagnostics. Unexpected errors SHALL preserve known committed outcomes and safe details without inventing missing results. Usage metrics SHALL remain optional observability data.

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

- **WHEN** a returned candidate contains a malformed source or official-link URL
- **THEN** the run reports `invalid_candidate`, retains the returned result and source-read history privately, and makes no catalog changes

#### Scenario: Research budget is exhausted

- **WHEN** research reaches its step or time limit without a valid result
- **THEN** the run reports `limit_reached` with a limit reason, source-read history, and available model questions
- **AND** it does not require or invent a complete list of unfinished checks

#### Scenario: A required result has an invalid reference

- **WHEN** a proposed ticket price cites an evidence reference that does not exist
- **THEN** the report identifies the validation failure and no item changes are applied
- **AND** valid earlier responses remain available for inspection

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

For excess facet terms, preparation MUST report `code:invalid_plan`, `stage:validation`, and the classification field path. Its message MUST identify the facet, limit, and conflicting IDs. The item MUST have no catalog operations.

#### Scenario: An accepted classification has two event types

- **WHEN** the final classification contains both `festival` and `gathering`
- **THEN** the error identifies the Edition slot's classification field, `event_type`, a limit of one, and both term IDs

## ADDED Requirements

### Requirement: Reports identify attempt and catalog outcome

Each final report MUST identify attempt, mode, scope, source-check and validation outcomes, place-check status, and catalog outcome. It MUST retain checks, questions, errors, known IDs, and the frozen date. Success MUST NOT certify complete checks. Catalog outcomes MUST distinguish created, updated, published, unchanged, skipped, and failed. Saved counts MUST describe catalog context; returned counts MUST count selected non-null Edition roles.

#### Scenario: A completed recheck changes nothing

- **WHEN** refresh confirms accepted facts without a change
- **THEN** the report identifies completed research and an unchanged catalog outcome

#### Scenario: Reports retain the two-slot contract

- **WHEN** add or refresh returns its final result
- **THEN** the report retains the named Edition slots in the result
- **AND** add reports the same frozen `currentDate` used throughout the run
- **AND** saved context and selected findings have separate counts

#### Scenario: No place check is required

- **WHEN** no Edition slots are selected or the run skips duplicate add
- **THEN** the report records locationStatus as not_run without inventing a place-check response

#### Scenario: The historical slot has ticket facts in its source

- **WHEN** only historical ticket evidence is available
- **THEN** the report does not claim that historical prices or links were audited
- **AND** a missing current-or-next slot does not substitute historical ticket work

### Requirement: Reports explain supported findings and catalog changes

Previews and writes SHALL show old and new values with reasons. Applied changes SHALL match audit. A write failure SHALL retain prepared operations, available results, and its error with no applied changes. Reports SHALL distinguish source findings, accepted updates, and place decisions. Saved sources SHALL remain private artifacts rather than separately attached report bodies. No-op decisions SHALL NOT claim fresh verification.

#### Scenario: Final execution responses are available

- **WHEN** execution produces final text and structured output
- **THEN** the private report retains available final responses without content filtering and distinguishes findings from accepted updates

#### Scenario: Research succeeds but writing fails

- **WHEN** a valid proposed update fails the catalog writer
- **THEN** the report retains research status, findings, prepared operations, and available model responses with the write-stage error
- **AND** applied `changes` is empty and a separate proposed diff is not required

#### Scenario: A source cannot be fetched

- **WHEN** a source read fails and no update is supported
- **THEN** its URL, UTC check time, and failure outcome remain visible without changing catalog facts

#### Scenario: A place update uses a historical point

- **WHEN** an Edition inherits coordinates
- **THEN** the report identifies the earlier saved Edition, its version, copied point and precision, the decision reason, and available distance comparison

#### Scenario: Place evidence reveals an identity conflict

- **WHEN** a required place check finds a material identity conflict
- **THEN** the report retains available findings and place-check results with no applied changes and does not invent unavailable responses
- **AND** locationStatus is rejected and a location_rejected diagnostic retains the supplied reason
- **AND** the attempt outcome is failed while the successful research status is preserved

#### Scenario: Geocoding context serves both Editions

- **WHEN** initial reverse results serve both selected slots
- **THEN** the report retains bounded request direction, safe input and result metadata, and the associated slot references
- **AND** initial requests remain distinct from actual tool calls without fabricated tool calls or model usage
- **AND** reverse observations identify nearby context without presenting returned coordinates as replacement candidates

### Requirement: Command results identify failed attempts

Failed source interpretation, required validation or place checks, writing, or required persistence SHALL produce a nonzero command result. Useful partial results or a valid place decision with unresolved questions alone SHALL NOT. Skipped optional work SHALL NOT count as execution failure.

#### Scenario: Duplicate add is skipped

- **WHEN** add recognizes an existing Event without a host failure
- **THEN** it reports skipped and exits zero without catalog writes

#### Scenario: New Event creation is declined

- **WHEN** add produces usable research but concludes there is insufficient support to create a new Event
- **THEN** it reports skipped with the reason, exits zero, and makes no catalog or publication writes

#### Scenario: A required place check fails technically

- **WHEN** a required place check fails without a valid result
- **THEN** the command exits nonzero and makes no catalog or publication writes

### Requirement: Reports retain execution context without usage totals

Final reports SHALL retain duration, budget settings and execution counters, executed models and prompt versions, and a real trace ID when available. They SHALL NOT maintain a separate token or cost summary. Geocoding observations SHALL remain available without claiming billed cost. Missing metrics SHALL NOT prevent report finalization.

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

#### Scenario: Place checks use a different model

- **WHEN** place checking uses a model different from other model calls
- **THEN** the report identifies its model and available trace correlation
- **AND** model usage is inspected in observability without report totals

#### Scenario: A provider URL contains authentication

- **WHEN** a geocoding request is made
- **THEN** the report records safe query and candidate metadata without the authenticated URL, key, headers, or transport payload

## REMOVED Requirements

### Requirement: Reports distinguish work and outcome

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Reports identify attempt and catalog outcome" retains the domain checks. Internal contracts belong in the design.

### Requirement: Reports retain findings and changes

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Reports explain supported findings and catalog changes" retains the domain checks. Internal contracts belong in the design.

### Requirement: Command results reflect attempt failures

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Command results identify failed attempts" retains the domain checks. Internal contracts belong in the design.

### Requirement: Reports link to optional execution metrics

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Reports retain execution context without usage totals" retains the domain checks. Internal contracts belong in the design.
