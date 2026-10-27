# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Ingestion is owner initiated and local`
- TO: `### Requirement: Ingestion is owner initiated`

## MODIFIED Requirements

### Requirement: Ingestion is owner initiated
Discovery, source checks, additions, and refreshes SHALL run only when the owner starts a local CLI, loopback Studio, or hosted Studio operation. The catalog SHALL NOT refresh itself on a schedule or require a hosted ingestion service.

#### Scenario: No owner starts a run
- **WHEN** no owner starts an ingestion operation
- **THEN** the catalog does not discover or refresh records autonomously

#### Scenario: Owner starts a run
- **WHEN** the owner starts ingestion through the CLI or loopback Studio
- **THEN** the operation can complete without a deployed collection server

#### Scenario: Owner starts hosted ingestion
- **WHEN** the owner starts an ingestion operation through hosted Studio
- **THEN** it uses the configured server catalog and the same validated workflow as local ingestion
- **AND** the operation starts only from that explicit request

### Requirement: Debug previews show changes without catalog writes
Through the CLI or Studio, the owner SHALL be able to preview proposed catalog changes and their old and new values. A preview SHALL retain no catalog record, version, audit, or receipt changes. Its ingestion run and final report SHALL remain available, including any transient new identifiers.

#### Scenario: Preview a correction
- **WHEN** the owner previews an Edition venue correction
- **THEN** the report shows the proposed change and reason while catalog state and audit history remain unchanged

#### Scenario: Preview a new Event
- **WHEN** the owner previews adding an Event and Editions
- **THEN** the final report retains the proposed changes even though no new catalog identities persist

### Requirement: Studio starts with a bounded preview

The local or hosted Studio workflow form SHALL accept add by name and one Event target per refresh, with the CLI's scope behavior. Studio chat SHALL also accept an owner-requested selection under the studio-assistant contract. Each selected Event SHALL use a separate full workflow execution. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions. Cancellation SHALL preserve known commits and safe failure details without requiring report usage totals.

#### Scenario: Studio preview and apply

- **WHEN** the owner runs the same valid target in Studio preview and then apply
- **THEN** preview retains no catalog changes and apply uses a new attempt against current state

#### Scenario: Invalid Studio target

- **WHEN** Studio receives an unsupported mode, target, or scope
- **THEN** it rejects the request before research and makes no catalog changes

#### Scenario: An active Studio run is cancelled

- **WHEN** the owner cancels a started Studio run
- **THEN** subsequent catalog writes stop, known commits remain, and the run attempts failed finalization without replaying work
- **AND** available usage metrics remain in optional observability

#### Scenario: Owner starts refresh through chat

- **WHEN** the owner requests refresh of a valid bounded selection in Studio chat
- **THEN** each Event uses the same workflow validation, preview or apply behavior, and durable attempt lifecycle as the form
- **AND** chat does not resume or replay saved ingestion plans
