## MODIFIED Requirements

### Requirement: New executions share saved workflow history

Studio SHALL save workflow history by default for previews and apply runs on the selected host, including runs started through the CLI. Studio SHALL list and open that history without model credentials or an active catalog connection. History SHALL remain independent of logging and tracing. Reports created before this feature SHALL NOT be converted into workflow history.

#### Scenario: A CLI run is inspected later

- **WHEN** a CLI ingestion execution finishes with logging and tracing disabled and the owner opens Recent runs in Studio
- **THEN** the execution appears in recent runs with its available step results
- **AND** opening it makes no source requests, model requests, or catalog writes

#### Scenario: A batch targets several Events

- **WHEN** a CLI command starts ingestion for several Events
- **THEN** each execution has its own saved workflow entry
- **AND** each execution that completes initialization has its own durable attempt association

#### Scenario: Earlier reports exist

- **WHEN** Studio opens a new workflow store beside a catalog with earlier ingestion reports
- **THEN** those reports remain in the catalog and do not appear as reconstructed workflow executions

### Requirement: Workflow history uses separate local storage

The owner SHALL be able to select the workflow history file at Studio startup. The file SHALL be separate from the effective catalog and observability files. A rejected file collision SHALL leave those files unchanged. Workflow history SHALL remain private to owner inspection on the selected host and SHALL NOT be served by the public website.

#### Scenario: CLI selects a custom catalog

- **WHEN** the owner configures Studio to use the same file or journal file for the catalog and workflow history
- **THEN** startup rejects the collision before opening workflow storage or starting external work

#### Scenario: Studio starts from another working directory

- **WHEN** Studio starts from another working directory
- **THEN** it uses the workflow history path configured at startup
