## MODIFIED Requirements

### Requirement: Output matches the stored final report

Studio and local run inspection SHALL use the same stored final report for a completed attempt. CLI output for a completed attempt SHALL show a summary that identifies the saved report and the workflow run.

#### Scenario: JSON output is requested

- **WHEN** an attempt finishes and the owner requests JSON output
- **THEN** the CLI returns the workflow summary with the attempt outcome, diagnostic codes, and both run IDs
- **AND** the ingestion run ID identifies the saved final report
