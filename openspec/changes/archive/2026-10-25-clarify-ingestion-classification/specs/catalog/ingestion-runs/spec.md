## ADDED Requirements

### Requirement: Classification count errors identify the conflict

For excess facet terms, preparation MUST report `code:invalid_plan`, `stage:validation`, and the classification field path. Its message MUST identify the facet, limit, and conflicting IDs. The item MUST have no catalog operations.

#### Scenario: An accepted classification has two event types

- **WHEN** the editor accepts both `festival` and `gathering`
- **THEN** the error identifies the Edition slot's classification field, `event_type`, a limit of one, and both term IDs
