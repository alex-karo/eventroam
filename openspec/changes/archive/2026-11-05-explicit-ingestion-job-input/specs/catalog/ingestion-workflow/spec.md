## MODIFIED Requirements

### Requirement: Studio starts with a bounded preview

The Studio workflow SHALL accept an explicit `mode` and a matching `input`. Add input SHALL be one nonblank note. Refresh input SHALL contain one `eventId` and an optional `scope` that defaults to full. Studio chat SHALL also accept an owner-requested selection for add or refresh under the studio-assistant contract. Each selected Event SHALL use a separate full workflow execution. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions. Cancellation SHALL preserve known commits and safe failure details without requiring report usage totals.

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

#### Scenario: Studio add input
- **WHEN** the owner submits add with a URL as its only input
- **THEN** the form starts the same add workflow as the CLI
- **AND** omission of input or use of only the former name field fails before research
