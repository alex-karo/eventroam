# Edition classification

## Purpose

Define the current fixed taxonomy structure, assignment boundaries, and public classification behavior.

## Requirements

### Requirement: Classification belongs to each Edition

The catalog SHALL assign existing TaxonomyTerms to Editions, never to Events. The fixed facets SHALL be `event_type`, `format`, `topic`, `genre`, and `culture`. `event_type` and `format` SHALL allow at most one assignment each; the other facets MAY hold multiple terms. A missing assignment SHALL mean unknown or unspecified, without an `unknown` term. An Edition's set SHALL not propagate to sibling editions or become an Event default.

#### Scenario: A later edition changes format

- **GIVEN** two published Editions under one Event
- **WHEN** only the later Edition's format is replaced
- **THEN** the earlier Edition keeps its original classification

### Requirement: Taxonomy terms have stable curated identities

A TaxonomyTerm SHALL have a stable ID, facet, slug, display name, and optional same-facet parent. `(facet, slug)` SHALL be unique; a term SHALL NOT parent itself or form an ancestry cycle. Assignment operations SHALL reference existing term IDs and reject unknown IDs, duplicate IDs, an assigned ancestor together with its descendant at any depth, or excess single-valued facet terms. Terms SHALL not be created implicitly from labels supplied to an Edition write.

#### Scenario: An unknown extracted label is submitted as an assignment

- **WHEN** a replacement references a nonexistent term
- **THEN** the replacement fails without creating a new vocabulary term or changing prior assignments

#### Scenario: A classification set is replaced with the same IDs

- **WHEN** a versioned replacement contains the existing set in any order
- **THEN** it makes no assignment or audit change

#### Scenario: Taxonomy ancestry would cycle

- **WHEN** a term is assigned itself or one of its descendants as parent
- **THEN** the catalog rejects that parent change

#### Scenario: An assignment contains an ancestor and descendant

- **GIVEN** a taxonomy term descends from another term through one or more parent relationships
- **WHEN** a replacement assigns both terms to the same Edition
- **THEN** the replacement fails without changing its assignments, version, or audit history

### Requirement: Genre ancestry controls discovery matches

A genre parent selection SHALL match its descendants in the stored taxonomy tree. Positive genre selection SHALL exclude editions with no matching known genre; unrestricted genre SHALL include them, including non-musical gatherings.

#### Scenario: Electronic is selected

- **GIVEN** a taxonomy where `psytrance` is a child of `electronic`, and an Edition assigned `psytrance`
- **WHEN** a visitor selects `electronic`
- **THEN** the Edition matches the genre condition

#### Scenario: Trance is selected

- **GIVEN** the same taxonomy, where `trance` is a sibling of `psytrance`, and an Edition assigned only `psytrance`
- **WHEN** a visitor selects `trance`
- **THEN** it does not match the genre condition

### Requirement: Public labels come from the displayed edition

The Event page SHALL show classifications from its selected published Edition only. Edition pages SHALL show that Edition's human-readable term labels. Draft editions SHALL not supply public badges, and classification selection SHALL not combine facts from different editions.

#### Scenario: The selected Event edition changes

- **WHEN** a new eligible Edition becomes the Event page's active edition
- **THEN** its classification labels replace the prior edition's summary without changing Event identity

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

### Requirement: Topics remain independent of physical format

Topic assignments SHALL describe programme content or participant offerings independently of the physical format. A topic assignment SHALL NOT establish a format assignment. An unknown format SHALL NOT prevent publication when the other publication requirements are met. Specific topic definitions and assignment guidance SHALL remain curated vocabulary rather than fixed specification requirements.

#### Scenario: Additional topics with unknown format

- **GIVEN** an Edition with topic assignments and no physical format assignment
- **WHEN** publication passes the other publication requirements
- **THEN** the Edition can publish
- **AND** its format remains unknown

### Requirement: Current research can explicitly reuse preceding classification
For a new selected current Edition, research SHALL check its announcement before reusing the nearest preceding comparable saved Edition's taxonomy. Reuse SHALL be a complete finding whose reason identifies the donor and continuity basis. Refuted terms SHALL be revised or excluded; ambiguous comparability SHALL NOT authorize copying. Omission SHALL NOT trigger inheritance.

#### Scenario: Programme continuity supports reuse
- **WHEN** inspected announcements support continuity with a preceding comparable Edition of the same Event
- **THEN** its supplied term IDs may be proposed with the donor key and continuity explanation.

#### Scenario: The programme or format changes
- **WHEN** current evidence refutes donor programme/format terms
- **THEN** exclude them, retain unchallenged comparable terms and use only supported supplied replacements.

#### Scenario: A chronological neighbor is not comparable
- **WHEN** the nearest predecessor has a different weekend/programme and comparability remains unverified
- **THEN** do not copy by date/year alone; classify from current evidence or omit with any unfinished assessment in unresolved.

#### Scenario: Reuse is omitted or rejected
- **WHEN** classification is omitted or proposed reuse is rejected
- **THEN** infer no sibling taxonomy or Event default; normal publication gates still apply.
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
