# Ingestion diagnostics delta

## MODIFIED Requirements

### Requirement: Location evaluation uses captured geocoding

Isolated Location evaluation SHALL use real preparation and execution with captured, normalized forward and reverse geocoding-client results, without live fallback. An unmatched initial or agent request SHALL return bounded fixture_miss and fail its case even after a valid plan. Saved Mastra experiment items SHALL retain available output, observations, actual tool calls, errors, scores, and valid siblings without a fabricated ingestion report. The command SHALL exit nonzero for failed cases. Experiment storage failures SHALL use native Mastra behavior without custom recovery or post-run storage checks.

#### Scenario: An initial reverse fixture is missing

- **WHEN** initial preparation requests a reverse response absent from the fixture
- **THEN** the case retains a fixture_miss observation and fails without a live request
- **AND** available later Location output and valid sibling results remain in saved Mastra experiment items

#### Scenario: The agent requests an uncaptured spelling

- **WHEN** an agent forward request has no matching fixture but a later decision is valid
- **THEN** the case still fails and retains the tool error and available decision

#### Scenario: The captured provider returns no match

- **WHEN** a matching fixture contains a genuine empty result or provider failure
- **THEN** the recorded outcome is supplied as test input rather than classified as fixture_miss

### Requirement: Evaluation artifacts separate reports from execution errors

A completed ingestion workflow evaluation SHALL retain one real ingestion report per available task output, without flat report copies. Execution errors and scorer results SHALL remain separate. Saved Mastra experiment items SHALL preserve case identity, repetition, provenance, assertion details, tool calls, and valid sibling results without a separate eval JSON file. The command SHALL exit nonzero for task or scorer errors, missing required scores, or failed cases. Saved errors SHALL follow the existing bounded safe-error rules. Experiment storage failures SHALL use native Mastra behavior; complete persistence and a failed CLI exit are not guaranteed for that exceptional case.

#### Scenario: The workflow returns a failed report

- **WHEN** a workflow returns a real report with a failed catalog outcome
- **THEN** evaluation retains and scores that report against its fixture expectations
- **AND** task execution success alone does not mark the case as passed

#### Scenario: Persistence fails with an available report

- **WHEN** run persistence fails and a real report is available
- **THEN** evaluation retains the report with the persistence failure and rejects the case

#### Scenario: A task fails without a report

- **WHEN** an evaluation task throws without an available ingestion report
- **THEN** the saved item has an execution error and no fabricated report
- **AND** valid sibling results remain in saved experiment items and the command exits nonzero

#### Scenario: A scorer fails

- **WHEN** a scorer fails or a required score is absent
- **THEN** the experiment retains available task output and scores without substituting success
- **AND** the command exits nonzero after the experiment completes
