## MODIFIED Requirements

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
