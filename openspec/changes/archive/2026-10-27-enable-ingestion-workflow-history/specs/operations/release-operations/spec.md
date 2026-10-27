# Spec Delta

## MODIFIED Requirements

### Requirement: Runtime data stays outside images

The website and Studio SHALL use the supplied catalog file. Studio SHALL use separate workflow history and observability files. Compose SHALL store all three files and their database sidecar files in one named volume at `/data`. Builds and normal startup SHALL NOT import development fixtures, replace these files, or require them as build inputs.

#### Scenario: Recreate the services

- **WHEN** containers are recreated with the same named volume
- **THEN** public records remain at `/data/eventroam.sqlite`, workflow history at `/data/mastra-workflows.sqlite`, and observations at `/data/mastra-observability.duckdb`

#### Scenario: The supplied catalog is missing

- **WHEN** the website starts without an existing catalog at its configured path
- **THEN** its health check fails and it does not create a catalog or load fixtures

#### Scenario: Workflow history is empty on first start

- **WHEN** Studio starts with an existing catalog and observability store but no workflow store
- **THEN** it creates an empty workflow store without importing old reports or replacing existing data
