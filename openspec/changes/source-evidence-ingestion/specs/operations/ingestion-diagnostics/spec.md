## MODIFIED Requirements

### Requirement: Observability remains local and correlated

Enabled logs, traces, and metrics SHALL remain separate from the catalog. Studio SHALL expose them after exit on the selected host without model credentials or a new run. Application logs SHALL retain the durable run ID. Traces and metrics SHALL identify their run and Event. Inspection SHALL distinguish source checks, validation, place decisions, and catalog outcomes from technical execution status. Phase, validation, and Edition details SHALL remain available in saved execution results and reports.

#### Scenario: Inspect a completed run

- **WHEN** the owner opens local inspection after a run exits
- **THEN** available observations can be correlated with its durable run ID without executing research

#### Scenario: Retrieval fails without throwing

- **WHEN** a source operation completes technically but returns a failed retrieval outcome
- **THEN** diagnostics retain that retrieval failure rather than claiming a successful source check

### Requirement: Studio inspection exposes execution progress

Local or hosted Studio SHALL expose the flow, progress, execution ID, run ID, and available source, validation, place, geocoding, catalog, and report outcomes. Opening inspection SHALL NOT start work or require model credentials. Execution state SHALL exclude credentials, authenticated provider URLs, prompts, full page bodies, transport payloads, live resources, and raw exceptions. Final model responses SHALL follow ingestion-run rules. Concurrent attempts SHALL remain distinct. Opening saved inspection SHALL NOT require an active catalog connection. Saved run inspection SHALL expose the original input, available step statuses and times, and available step results after process exit.

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
- **AND** source-check results, processing limits, proposed and accepted updates, normalized geocoding observations, prepared operations, and confirmed write results remain distinguishable
- **AND** technical execution success does not replace source-check, validation, or place-check status, catalog outcome, or report persistence status

#### Scenario: A start request includes private request context

- **WHEN** a start request carries separate credentials, prompts, source bodies, or provider payloads in request context
- **THEN** saved history excludes that request context while retaining allowed final model responses

#### Scenario: Inspect evidence after exit

- **WHEN** an execution has persisted source artifacts
- **THEN** saved results identify the private corpus, source references and processing limits
- **AND** a missing artifact is reported as missing rather than fetched again
- **AND** this change does not require a new public source viewer

### Requirement: Removing workflow history preserves catalog records

Workflow snapshots SHALL remain until the owner deletes them. Deleting a saved execution or resetting the separate workflow store SHALL NOT delete catalog facts, audit records, durable ingestion reports, private source artifacts, or observability records. Automatic age-based deletion SHALL remain outside this feature.

#### Scenario: The owner deletes a completed execution

- **WHEN** the owner deletes a completed execution through the workflow history API
- **THEN** it disappears from workflow history while its durable ingestion report and catalog records remain

#### Scenario: The owner resets the workflow store

- **WHEN** the owner stops its writers and Studio and removes only the workflow store and its journal files
- **THEN** the next start creates empty workflow history and leaves the other stores unchanged

### Requirement: Location evaluation uses captured geocoding

Isolated Location evaluation SHALL execute Location with recorded forward and reverse geocoding results. Saved results SHALL retain available output, initial observations, agent tool calls, errors, and scores. They SHALL NOT contain a fabricated ingestion report.

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

## ADDED Requirements

### Requirement: Execution observations remain inspectable and qualified

Enabled tracing SHALL record available stage duration, technical status, token usage, and model cost with run correlation. Available observations SHALL distinguish the work that produced them. Reported and estimated costs SHALL remain distinct; missing cost SHALL NOT become zero. Metrics SHALL remain inspectable after exit without claiming complete spending. Reports and run-history statistics SHALL NOT maintain copies of token or cost totals. Metric failure SHALL NOT alter catalog or report outcomes.

#### Scenario: Research and editing use the same model

- **WHEN** an eligible run records both operations
- **THEN** their observations can be grouped separately while correlating to the same durable run

#### Scenario: Provider cost is incomplete

- **WHEN** a model operation lacks complete reported cost
- **THEN** its metric identifies an available pricing estimate as such, or leaves cost unknown

#### Scenario: Metrics cannot be persisted

- **WHEN** metric recording or shutdown fails
- **THEN** the run keeps its original result and a diagnostic is available

#### Scenario: A place check has geocoding failures

- **WHEN** a place check completes technically after a geocoding error
- **THEN** inspection distinguishes the provider error, the place-check result, and the final catalog outcome
- **AND** it does not expose the authenticated request URL

#### Scenario: Geocoding occurs outside a model call

- **WHEN** a reverse request prepares place context
- **THEN** inspection identifies these requests separately from later model tool calls
- **AND** no model generation or usage is invented for preparation

#### Scenario: Several model calls use one source

- **WHEN** tracing records several model calls for one source
- **THEN** available observations identify their source and run
- **AND** usage remains inspectable without report cost totals

## REMOVED Requirements

### Requirement: Source-result capture is explicit and separate

**Reason**: Required saved source artifacts and workflow results cover source inspection. The owner chose to remove the separate optional capture feature.

**Migration**: Inspect required private Markdown, evidence, and saved workflow results. Remove `CATALOG_CAPTURE_TOOL_OUTPUTS` and its debug writer. These records do not replace the exact ordered tool-response dump, including discovery responses and repeated cached results.

### Requirement: Execution metrics remain inspectable and qualified

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Execution observations remain inspectable and qualified" retains the domain checks. Internal contracts belong in the design.
