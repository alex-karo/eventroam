# Proposal

## Why

Catalog commands start a second Mastra process. When Studio and the command use the same DuckDB file, the command cannot record diagnostics while Studio is running.

## What Changes

- Send CLI add and refresh requests to the running local Studio workflow.
- Use the workflow summary for CLI output and keep detailed reports in saved history.
- **BREAKING** Select the catalog and limits at Studio startup. Remove the CLI file export and its separate report format.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-workflow`
  - **Before** The owner can start ingestion from the CLI or Studio. Both can show preview details.
  - **After** The CLI needs local Studio and shows the result of each execution. Studio shows the saved preview details.
- `catalog/ingestion-runs`
  - **Before** The CLI can print or export the full report.
  - **After** The CLI prints a summary with IDs that refer to the saved report.
- `operations/ingestion-diagnostics`
  - **Before** CLI and Studio can open the same configured history file.
  - **After** Studio owns the history file and records CLI executions in it.

## Impact

The catalog command, ingestion guides, and workflow transport tests change. Evaluation execution is outside this change.
