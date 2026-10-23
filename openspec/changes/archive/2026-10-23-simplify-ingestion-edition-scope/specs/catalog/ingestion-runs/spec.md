# Spec Delta

## MODIFIED Requirements

### Requirement: Reports distinguish work and outcome

Each final report MUST identify its attempt, mode, scope, research status, editorial status, and catalog outcome.
It MUST include source checks, questions, errors, and known record IDs.
Each success status MUST describe the success of its operation. It MUST NOT certify complete Edition or field checks.
Outcomes MUST distinguish `created`, `updated`, `published`, `unchanged`, `skipped`, and `failed`.
Add and refresh MUST show the frozen date and saved and returned Edition counts.
Returned counts MUST count non-null research slots. Saved counts MUST describe available catalog context.

#### Scenario: A completed recheck changes nothing

- **WHEN** refresh confirms accepted facts without a change
- **THEN** the report identifies completed research and an unchanged catalog outcome

#### Scenario: Reports retain the two-slot contract

- **WHEN** add or refresh returns final research or editorial output
- **THEN** the report retains the named Edition slots in the separate raw responses
- **AND** add reports the same frozen `currentDate` used by research and editing
- **AND** saved context and selected findings have separate counts

### Requirement: Report consumers reject unsupported versions

The current report contract SHALL use version 6. Consumers SHALL reject unsupported versions explicitly.

#### Scenario: An unsupported report version is read

- **WHEN** a consumer receives a report version it does not support
- **THEN** it rejects that version explicitly without silently converting or filling gaps

#### Scenario: Historical reports remain unchanged

- **WHEN** the active contract changes from version 5 to version 6
- **THEN** newly generated reports use version 6 and stored historical report JSON remains unchanged
- **AND** consumers do not convert or fill gaps in unsupported reports
