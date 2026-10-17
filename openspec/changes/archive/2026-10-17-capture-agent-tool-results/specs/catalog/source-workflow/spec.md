# Spec Delta

## ADDED Requirements

### Requirement: Owner can capture agent-visible source results locally
The local ingestion process SHALL capture research source content only when `CATALOG_CAPTURE_TOOL_OUTPUTS=true`. It SHALL save each `readPage` and `searchWeb` result as the research agent received it, after existing normalization and limits. It SHALL also save the initial source projection passed in `inspectedSources` before the first agent call. Capture SHALL work for local CLI and Studio attempts and SHALL be off by default.

#### Scenario: Capture a page and a search
- **WHEN** an owner enables capture and a run supplies an initial source, returns a `readPage` result, and returns a `searchWeb` result
- **THEN** the local capture contains the initial source projection, the agent-visible page Markdown and response fields, and the normalized search response
- **AND** it contains no page text beyond what the agent received

#### Scenario: Agent reuses a cached page
- **WHEN** the agent calls `readPage` twice for the same URL and the second result comes from the source cache
- **THEN** the capture retains both responses in call order, including each response's remaining-budget fields

#### Scenario: Capture is disabled
- **WHEN** the capture setting is absent or is not `true`
- **THEN** the run creates no tool-result capture files

### Requirement: Captured results remain separate from durable ingestion records
The process SHALL place captured results under an ignored local `data/catalog-debug/<runId>/` directory and identify their call order and origin. It SHALL NOT add source bodies or search response content to catalog run records, final reports, logs, or traces. A capture write failure SHALL be visible to the owner and SHALL NOT change research, catalog writes, run finalization, or exit status.

#### Scenario: Owner inspects one run
- **WHEN** capture is enabled for a run with several source results
- **THEN** each saved result can be matched to its runId, tool or initial source, and call order
- **AND** the existing report and observability content boundaries remain intact

#### Scenario: Local capture cannot be written
- **WHEN** a capture directory or file cannot be written
- **THEN** the owner receives a bounded capture diagnostic
- **AND** the attempt follows its normal research and catalog outcome
