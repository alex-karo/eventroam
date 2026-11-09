# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: The editor resolves classification count conflicts`
- TO: `### Requirement: Classification revises lists with excess facet terms`

## MODIFIED Requirements

### Requirement: Ingestion classification updates are edition-specific

Research MUST attach each complete classification finding to one Edition and retain unchallenged saved terms.
If Editor approves classification, ingestion MUST use the complete list from Classification.
The host MUST normalize redundant ancestors before replacement.
Replacement MUST affect only that Edition. It MUST NOT create Event defaults or change sibling Editions.
An omitted classification MUST preserve current assignments.

#### Scenario: A later check omits a known term

- **WHEN** new evidence does not mention or refute a saved term
- **THEN** research retains it in the complete list or omits classification
- **AND** removing a redundant ancestor follows the normalization rule below

#### Scenario: An edition term is removed

- **WHEN** research refutes an assigned term and the editor approves a complete list without it
- **THEN** the writer removes that assignment from that Edition only
- **AND** sibling Editions retain their assignments

### Requirement: Ingestion removes redundant classification ancestors

For a complete classification list that Editor approves, ingestion MUST remove each selected term with a selected descendant at any depth.
It MUST preserve the remaining terms and MUST NOT add descendants.
Normalization MUST precede catalog operations. Invalid IDs, duplicates, and invalid facet counts MUST still fail validation.
The report MUST explain normalization in changed-assignment diffs, including previews. Direct catalog writes MUST retain the ancestor validation rule.

#### Scenario: A selected descendant replaces a redundant ancestor

- **WHEN** the final classification contains an ancestor and its descendant through one or more parent links
- **THEN** ingestion removes the ancestor and retains the descendant
- **AND** a changed-assignment diff identifies the removed ancestor and retained descendant
- **AND** this removal does not require evidence that refutes the ancestor's broader meaning

#### Scenario: Only a broad term is supported

- **WHEN** the final classification contains an ancestor without a selected descendant
- **THEN** ingestion retains that term without adding a more specific term

#### Scenario: Selected terms share an ancestor

- **WHEN** the final classification contains sibling terms without their ancestor
- **THEN** ingestion retains both siblings

#### Scenario: Classification is kept or omitted

- **WHEN** Editor rejects a classification change or Classification omits the list
- **THEN** ingestion preserves saved assignments without normalization writes

#### Scenario: An invalid list reaches preparation

- **WHEN** the final list contains an unknown ID, duplicate ID, or excess terms in a single-valued facet
- **THEN** ingestion rejects the item without writes
- **AND** ancestor normalization does not hide the invalid input

#### Scenario: A direct write bypasses ingestion preparation

- **WHEN** a catalog assignment operation contains an ancestor and its descendant
- **THEN** the writer rejects it without assignment, version, or audit changes

### Requirement: Classification revises lists with excess facet terms

Validation MUST return a list with excess known facet terms to Classification under the group return rules. Classification MUST supply a supported complete list or omit it and report uncertainty. Ingestion MUST NOT select a term automatically. An invalid final list MUST produce no catalog operations.

#### Scenario: Research supplies two event types

- **GIVEN** a research finding with both `festival` and `gathering`
- **WHEN** validation returns the group and Classification supplies a supported complete list with `festival` as its only `event_type`
- **THEN** Editor reviews the revised list, including its other terms
- **AND** approval affects only that Edition

#### Scenario: Evidence does not resolve the type

- **WHEN** Classification cannot support a choice between the proposed types
- **THEN** it omits classification and reports an unresolved question
- **AND** review of the omission preserves the saved assignments
