## ADDED Requirements

### Requirement: Classification has an isolated eval group

The CLI SHALL provide `regression/classification` for direct Classification execution. Each case SHALL supply fixed Edition targets, bound source evidence, saved context, and vocabulary. The eval SHALL use the production Classification role and keep the expected categories and description reference out of its input. It SHALL assess the direct result before any catalog review or write. This group SHALL be included in `--all` and excluded from the default run.

#### Scenario: A source announces a new format

- **WHEN** a case supplies evidence of a new format and expects new categories and both texts
- **THEN** the case requires the declared category IDs without extra or duplicate IDs
- **AND** it requires a set proposal and a Decider probability of at least 0.80 for each text
- **AND** it requires three to five sentences for the detailed text and one or two for the short text, both without the festival name
- **AND** a missing, low, or unavailable assessment fails the case and is reported for that field

#### Scenario: The group runs on its own

- **WHEN** the command selects `regression/classification`
- **THEN** it runs only Classification and the description judge
- **AND** it saves the Classification execution, per-field probabilities, and scenario checks as an experiment

### Requirement: Main eval checks the current format in descriptions

Main eval SHALL compare each stored festival description with the case reference for the current format. It SHALL save and display the probability of a match for each assessed field. Each numeric result SHALL count as one required fact. A probability of at least 0.80 SHALL satisfy the fact. A lower probability SHALL count as a missing required fact and fail the scenario without adding a factual error.

#### Scenario: Only one field meets the threshold

- **WHEN** one description scores 0.80 and the other scores below 0.80
- **THEN** required completeness counts one correct fact and one missing fact for the two fields
- **AND** the scenario fails

#### Scenario: One description is missing

- **WHEN** a main case has a format reference and only one stored description
- **THEN** the report shows the probability for the stored text and marks the other field missing
- **AND** only the assessed field contributes to required completeness

#### Scenario: The check cannot assess a text

- **WHEN** the case has no format reference or the decision provider fails
- **THEN** the report distinguishes a case without a reference from an unavailable decision
- **AND** fields without a numeric result do not contribute to required completeness
