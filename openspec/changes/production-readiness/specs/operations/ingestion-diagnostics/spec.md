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
Local or hosted Studio SHALL expose the ingestion flow, live progress, execution ID, durable run ID, and available research, editorial, source, catalog, and report outcomes. Merely opening inspection SHALL NOT start an attempt or require catalog or model credentials. Saved execution data and errors SHALL NOT separately copy application or SDK credentials, prompts, full page bodies, provider payloads, live resources, or raw exceptions. Available model responses SHALL follow the preservation rules in [ingestion runs](../../catalog/ingestion-runs/spec.md). Concurrent attempts SHALL remain distinct in inspection.

#### Scenario: Open Studio without execution prerequisites
- **WHEN** the owner opens the ingestion view without model credentials
- **THEN** the flow and saved observations are inspectable without starting a run

#### Scenario: Inspect a failed attempt
- **WHEN** an attempt fails after returning research findings
- **THEN** Studio exposes available phase outcomes, model responses, and the failure stage without separately attaching page bodies or provider payloads

#### Scenario: An active execution ID is reused
- **WHEN** a caller supplies an execution ID already in use
- **THEN** Studio rejects that execution before work without affecting the original attempt
