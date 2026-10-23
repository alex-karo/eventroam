# Spec Delta

## MODIFIED Requirements

### Requirement: Ingestion classification updates are edition-specific

Research MUST attach each complete classification finding to one Edition and retain unchallenged saved terms.
If the editor accepts or corrects classification, it MUST use the complete list.
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

## ADDED Requirements

### Requirement: Ingestion removes redundant classification ancestors

For an accepted or corrected complete classification, ingestion MUST remove each selected term with a selected descendant at any depth.
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

- **WHEN** the editor keeps classification or supplies no classification action
- **THEN** ingestion preserves saved assignments without normalization writes

#### Scenario: An invalid list reaches preparation

- **WHEN** the list contains an unknown ID, duplicate ID, or excess terms in a single-valued facet
- **THEN** ingestion rejects the item without writes
- **AND** ancestor normalization does not hide the invalid input

#### Scenario: A direct write bypasses ingestion preparation

- **WHEN** a catalog assignment operation contains an ancestor and its descendant
- **THEN** the writer rejects it without assignment, version, or audit changes

### Requirement: Format describes the setting of the main programme

The `format` facet MUST describe the physical setting of an Edition's main programme.
`openair` MUST mean an open site is the primary setting. `indoor` MUST mean enclosed spaces are the primary setting.
`mixed-indoor-outdoor` MUST mean substantial parts of the main programme use both settings.
When both settings qualify, mixed MUST take precedence over either single-setting label.
Support facilities and a single physical feature MUST NOT determine format. Unclear evidence MUST leave format unknown.

#### Scenario: The site is the primary programme setting

- **WHEN** inspected evidence describes an open site as the main programme setting
- **THEN** research can propose `openair` with that basis
- **AND** a roof or enclosure alone does not determine the whole Edition's format

#### Scenario: Enclosed spaces contain the main programme

- **WHEN** inspected evidence places the main programme in enclosed spaces
- **THEN** research can propose `indoor`
- **AND** outdoor access, camping, or other support facilities alone do not establish a mixed format

#### Scenario: Both settings carry substantial programme content

- **WHEN** inspected evidence establishes substantial main programme content in open and enclosed settings
- **THEN** research can propose `mixed-indoor-outdoor`
- **AND** incidental use of the second setting is insufficient

#### Scenario: Available evidence does not establish the setting

- **WHEN** inspected evidence gives only a venue name, branding, or a physical feature
- **THEN** research omits format unless other inspected evidence establishes the main programme setting
- **AND** the editor uses the same definition when it assesses a format finding
