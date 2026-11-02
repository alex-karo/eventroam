# Spec Delta

## ADDED Requirements

### Requirement: Background attempts retain job identity
Each background attempt SHALL save its trusted job ID before source, model, or catalog work. A job SHALL support several attempts with distinct run IDs after the worker restarts. Earlier attempts SHALL remain unchanged and readable. Direct CLI and Studio form attempts SHALL require no job ID. Job association SHALL NOT change report version or attempt lifecycle.

#### Scenario: Start a background attempt
- **WHEN** a job starts ingestion
- **THEN** its new running attempt and job association are saved together before research

#### Scenario: Job runs again after restart
- **WHEN** a saved running job is processed again after the worker restarts
- **THEN** it gets a new attempt ID with the same job ID
- **AND** earlier attempts and available reports remain unchanged

#### Scenario: Attempt cannot be saved
- **WHEN** attempt creation or job association cannot be persisted
- **THEN** no external work starts for that execution

#### Scenario: Run ingestion directly
- **WHEN** the owner starts ingestion through the CLI or Studio form
- **THEN** normal attempt history requires no job ID
