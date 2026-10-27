# Spec Delta

## MODIFIED Requirements

### Requirement: Observability remains local and correlated

Enabled logs, traces, and metrics SHALL be stored separately from the catalog and remain inspectable after exit through local or hosted Studio on the selected host without model credentials or a new ingestion run. They SHALL carry the durable ingestion run ID and real trace or span relationships where available. Labels SHALL distinguish context Editions from confirmed created or updated Editions without inferring unknown years. Technical operation success SHALL remain distinct from research and catalog outcomes.

#### Scenario: Inspect a completed run

- **WHEN** the owner opens local inspection after a run exits
- **THEN** available observations can be correlated with its durable run ID without executing research

#### Scenario: Retrieval fails without throwing

- **WHEN** a source operation completes technically but returns a failed retrieval outcome
- **THEN** diagnostics retain that retrieval failure rather than claiming a successful source check

### Requirement: Studio inspection exposes execution progress

Local or hosted Studio SHALL expose the flow, progress, execution ID, run ID, and available research, editorial, Location, geocoding, source, catalog, and report outcomes. Opening inspection SHALL NOT start work or require model credentials. Execution state SHALL exclude credentials, authenticated provider URLs, prompts, full page bodies, transport payloads, live resources, and raw exceptions. Final model responses SHALL follow ingestion-run rules. Concurrent attempts SHALL remain distinct. Opening saved inspection SHALL NOT require an active catalog connection. Saved run inspection SHALL expose the original input, available step statuses and times, and available step results after process exit.

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
- **AND** research findings, editorial actions, Location decisions, normalized geocoding observations, prepared operations, and confirmed write results remain distinguishable
- **AND** native workflow success does not replace research status, editorial status, Location status, catalog outcome, or report persistence status

#### Scenario: A start request includes private request context

- **WHEN** a native start request carries separate credentials, prompts, source bodies, or provider payloads in request context
- **THEN** saved history excludes that request context while retaining allowed final model responses
