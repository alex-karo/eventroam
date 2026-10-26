# Spec Delta

## MODIFIED Requirements

### Requirement: Ingestion persistence validates lifecycle state

Ingestion start and finalization SHALL enforce input/mode agreement, allowed status, lifecycle consistency, valid report structure, and nonnegative integer duration and budget counters through application validation and controlled state transitions. Finalization SHALL atomically affect exactly one matching running attempt and preserve persistence-failure reporting. Removed token, cost, and completeness statistics SHALL NOT be required for finalization.

#### Scenario: Invalid final accounting

- **WHEN** finalization supplies a negative or fractional duration or budget counter
- **THEN** application validation rejects the finalization and the stored running attempt remains unchanged

#### Scenario: Attempt is finalized twice

- **WHEN** finalization targets an attempt that is already finalized or has a different mode
- **THEN** it fails without overwriting the persisted result

#### Scenario: Finalization has no spending data

- **WHEN** a valid version 7 report has no token counts, costs, or accounting-completeness flag
- **THEN** finalization accepts it without querying observability or inventing statistics
