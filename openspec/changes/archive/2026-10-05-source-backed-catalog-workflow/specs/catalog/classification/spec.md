# Spec Delta

## MODIFIED Requirements

### Requirement: Model-proposed classification is edition-specific
The model SHALL associate classification additions and removals with a specific Occurrence. The host SHALL apply those proposals while preserving classifications on sibling editions and Event defaults. Omitted term claims SHALL preserve current assignments.

#### Scenario: A later extraction omits a known term
- **WHEN** a model answer does not mention a previously accepted genre
- **THEN** the run preserves that assignment

#### Scenario: Model removes an edition term
- **WHEN** the model explicitly proposes `removeTermIds` for an Occurrence
- **THEN** the writer removes those terms from that Occurrence only
