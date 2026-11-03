## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Source-result capture is explicit and separate

**Reason**: Required saved source artifacts and workflow results cover source inspection. The owner chose to remove the separate optional capture feature.

**Migration**: Inspect required private Markdown, evidence, and saved workflow results. Remove `CATALOG_CAPTURE_TOOL_OUTPUTS` and its debug writer. These records do not replace the exact ordered tool-response dump, including discovery responses and repeated cached results.
