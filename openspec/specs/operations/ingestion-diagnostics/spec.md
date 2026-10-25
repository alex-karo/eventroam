# Ingestion diagnostics

## Purpose

Define optional inspection of ingestion execution on the selected host and the fields selected for diagnostic records.

## Requirements

### Requirement: Logging and tracing are independently optional
The owner SHALL be able to enable local application logging independently of tracing. Both SHALL be off or ineligible without changing ingestion behavior. Tracing and execution metrics SHALL apply to eligible apply runs; previews SHALL produce no research spans or metrics. Observability failures SHALL not change research decisions, catalog writes, durable run history, accounting, or exit status.

#### Scenario: Logging without tracing
- **WHEN** the owner enables logging but not tracing
- **THEN** selected events may be inspected without trace spans or execution metrics

#### Scenario: Tracing without logging
- **WHEN** an eligible apply run enables tracing but not logging
- **THEN** spans and eligible metrics may persist without application log records

#### Scenario: Observability storage fails
- **WHEN** an observability store cannot be opened, written, or closed
- **THEN** ingestion keeps its original result and emits a bounded content-free diagnostic

#### Scenario: Another process owns observability storage
- **WHEN** another process prevents opening the local store
- **THEN** ingestion continues with a bounded diagnostic without taking ownership from that process

### Requirement: Observability remains local and correlated
Enabled logs, traces, and metrics SHALL be stored separately from the catalog and remain inspectable after exit through local or hosted Studio on the selected host without model credentials or a new ingestion run. They SHALL carry the durable ingestion run ID and real trace or span relationships where available. Labels SHALL distinguish context Editions from confirmed created or updated Editions without inferring unknown years. Technical operation success SHALL remain distinct from research and catalog outcomes.

#### Scenario: Inspect a completed run
- **WHEN** the owner opens local inspection after a run exits
- **THEN** available observations can be correlated with its durable run ID without executing research

#### Scenario: Retrieval fails without throwing
- **WHEN** a source operation completes technically but returns a failed retrieval outcome
- **THEN** diagnostics retain that retrieval failure rather than claiming a successful source check

### Requirement: Traces exclude content payloads
Stored traces SHALL exclude prompts, message history, full source bodies, full model responses, transport payloads, application or SDK credentials, and raw errors. This SHALL include fields attached automatically by tooling. Traces MAY retain bounded public source URLs, retrieval method and outcome, timing, record identity, validation status, and the final run outcome. Selected public URLs SHALL NOT require secret detection or redaction. A failure to enforce the field exclusions SHALL prevent the excluded fields from persisting.

#### Scenario: A model span includes prompt content
- **WHEN** tracing receives automatically attached prompts or message history
- **THEN** the stored span omits that content while retaining safe correlation and status

#### Scenario: A source read is traced
- **WHEN** an inspected source produces content and links
- **THEN** the trace may retain its bounded public URL and outcome without the page body

### Requirement: Application logs use selected bounded fields
Enabled logs SHALL identify severity, a short message, run ID, and selected run or source context. They SHALL cover retrieval, discovery, model, validation, write, and completion outcomes. Logs SHALL NOT separately copy full prompts, source content, transport data, application or SDK credentials, or raw exceptions at any level. Selected public URLs and permitted model text SHALL NOT require secret detection or redaction. Unobserved outcomes SHALL NOT be fabricated.

#### Scenario: A source is fetched
- **WHEN** a source read returns content
- **THEN** a log may retain its URL, status, and content length without the source text

#### Scenario: A preview is logged
- **WHEN** a preview reports proposed catalog changes
- **THEN** logs distinguish the preview from committed writes

### Requirement: Logged model text is separate and limited
Logs MAY include two separate text fields from a completed model step: model commentary and reasoning text returned by the provider. Each field SHALL contain at most 4,000 Unicode code points and identify its original length and whether it was shortened. Logs SHALL NOT collect incomplete streaming text, infer reasoning the provider did not return, or duplicate final structured results.

#### Scenario: Completed model text is long
- **WHEN** model commentary or returned reasoning exceeds 4,000 Unicode code points
- **THEN** the saved event contains only the first 4,000 code points of that field, its original length, and a shortening flag

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

### Requirement: Source-result capture is explicit and separate
The owner MAY enable local capture with `CATALOG_CAPTURE_TOOL_OUTPUTS=true`. It SHALL save bounded source and discovery results supplied to research, including initial context and repeated cached results in call order. Capture SHALL be off by default, identified by run ID, and kept in ignored local debug storage. Capture SHALL NOT separately attach source bodies or search responses to runs, reports, logs, or traces. Text repeated in model responses SHALL follow the model-output rules above. Capture write failure SHALL be visible without changing ingestion's outcome.

#### Scenario: Capture is enabled
- **WHEN** the owner enables capture and research reads a page and a discovery result
- **THEN** the saved capture contains those agent-visible bounded results and identifies their order and run ID

#### Scenario: Capture is disabled
- **WHEN** the owner does not enable capture
- **THEN** no source-result capture files are created

#### Scenario: Capture cannot be written
- **WHEN** local debug storage rejects a capture write
- **THEN** the owner receives a bounded diagnostic and the ingestion outcome is unaffected

### Requirement: Execution metrics remain inspectable and qualified
Eligible traced apply runs SHALL record available operation duration, technical status, token usage, and model cost with run correlation. Reported cost and pricing estimates SHALL remain distinguishable; unknown and known-zero cost SHALL remain distinct. Metrics SHALL remain inspectable after exit without claiming complete spending or replacing durable report accounting. Metric failure SHALL not alter the catalog or report outcome.

#### Scenario: Research and editing use the same model
- **WHEN** an eligible run records both operations
- **THEN** their observations can be grouped separately while correlating to the same durable run

#### Scenario: Provider cost is incomplete
- **WHEN** a model operation lacks complete reported cost
- **THEN** its metric identifies an available pricing estimate as such, or leaves cost unknown

#### Scenario: Metrics cannot be persisted
- **WHEN** metric recording or shutdown fails
- **THEN** the run keeps its original result and a content-free diagnostic is available
