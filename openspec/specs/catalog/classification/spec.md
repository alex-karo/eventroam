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

### Requirement: Model-proposed classification is edition-specific
Research SHALL associate a complete classification finding with a specific Edition, retaining unchallenged saved terms. The editor SHALL accept or correct the complete list. The host SHALL replace assignments only for that Edition, preserving sibling editions' classifications and assigning no classifications or defaults to the Event. An omitted classification field SHALL preserve current assignments.

#### Scenario: A later extraction omits a known term
- **WHEN** new evidence does not mention or refute a previously accepted genre
- **THEN** research retains it in any proposed complete list, or omits the classification field to preserve assignments

#### Scenario: Model removes an edition term
- **WHEN** research explicitly refutes an assigned term and editor approves a complete list excluding it for a specific Edition
- **THEN** the writer removes that assignment from that Edition only, preserving sibling editions' assignments

### Requirement: Topics remain independent of physical format

Topic assignments SHALL describe programme content or participant offerings independently of the physical format. A topic assignment SHALL NOT substitute for a format assignment required by publication rules. Specific topic definitions and assignment guidance SHALL remain curated vocabulary rather than fixed specification requirements.

#### Scenario: Additional topics without an eligible format

- **GIVEN** an edition with additional topic assignments but no eligible physical format
- **WHEN** publication is attempted
- **THEN** those topics do not satisfy the publication format gate
