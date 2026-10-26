# Spec Delta

## MODIFIED Requirements

### Requirement: Provider unavailability has bounded recovery

Ordinary research SHALL make bounded recovery attempts only for explicit provider unavailability within the run deadline. It SHALL retain completed work without duplicating catalog writes. Available usage metrics SHALL follow the optional observability contract rather than separate report accounting. Other model failures SHALL NOT trigger automatic retries.

#### Scenario: A provider is temporarily unavailable

- **WHEN** the model provider explicitly reports unavailability while research has time remaining
- **THEN** the run retries within its budget while retaining completed work
- **AND** available model-call metrics remain in optional observability

#### Scenario: A different model failure occurs

- **WHEN** the provider fails for another reason
- **THEN** the run reports a safe model failure without retrying that failure automatically

### Requirement: Studio starts with a bounded preview

Local or hosted Studio SHALL accept add by name and one Event target per refresh, with the CLI's scope behavior. It SHALL default to preview with republish permission off. Apply SHALL require an explicit request. Invalid input SHALL fail before external work. Each execution SHALL start from current catalog state and remain isolated from concurrent executions. Cancellation SHALL preserve known commits and safe failure details without requiring report usage totals.

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
