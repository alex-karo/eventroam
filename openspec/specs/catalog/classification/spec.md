# Occurrence classification

## Purpose

Define the current fixed taxonomy structure, assignment boundaries, and public classification behavior.

## Requirements

### Requirement: Classification belongs to each Occurrence

The catalog SHALL assign existing TaxonomyTerms to Occurrences, never to Events. The fixed facets SHALL be `event_type`, `format`, `topic`, `genre`, and `culture`. `event_type` and `format` SHALL allow at most one assignment each; the other facets MAY hold multiple terms. A missing assignment SHALL mean unknown or unspecified, without an `unknown` term. An Occurrence's set SHALL not propagate to sibling editions or become an Event default.

#### Scenario: A later edition changes format

- **GIVEN** two published Occurrences under one Event
- **WHEN** only the later Occurrence's format is replaced
- **THEN** the earlier Occurrence keeps its original classification

### Requirement: Taxonomy terms have stable curated identities

A TaxonomyTerm SHALL have a stable ID, facet, slug, display name, and optional same-facet parent. `(facet, slug)` SHALL be unique; a term SHALL NOT parent itself or form an ancestry cycle. Assignment operations SHALL reference existing term IDs and reject unknown IDs, duplicate IDs, an assigned ancestor together with its descendant at any depth, or excess single-valued facet terms. Terms SHALL not be created implicitly from labels supplied to an Occurrence write.

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
- **WHEN** a replacement assigns both terms to the same Occurrence
- **THEN** the replacement fails without changing its assignments, version, or audit history

### Requirement: Genre ancestry controls discovery matches

A genre parent selection SHALL match its descendants in the stored taxonomy tree. Positive genre selection SHALL exclude editions with no matching known genre; unrestricted genre SHALL include them, including non-musical gatherings.

#### Scenario: Electronic is selected

- **GIVEN** a taxonomy where `psytrance` is a child of `electronic`, and an Occurrence assigned `psytrance`
- **WHEN** a visitor selects `electronic`
- **THEN** the Occurrence matches the genre condition

#### Scenario: Trance is selected

- **GIVEN** the same taxonomy, where `trance` is a sibling of `psytrance`, and an Occurrence assigned only `psytrance`
- **WHEN** a visitor selects `trance`
- **THEN** it does not match the genre condition

### Requirement: Public labels come from the displayed edition

The Event page SHALL show classifications from its selected published Occurrence only. Occurrence pages SHALL show that Occurrence's human-readable term labels. Draft editions SHALL not supply public badges, and classification selection SHALL not combine facts from different editions.

#### Scenario: The selected Event edition changes

- **WHEN** a new eligible Occurrence becomes the Event page's active edition
- **THEN** its classification labels replace the prior edition's summary without changing Event identity

### Requirement: Model-proposed classification is edition-specific
The model SHALL associate classification additions and removals with a specific Occurrence. The host SHALL apply those proposals only to that Occurrence, preserving sibling editions' classifications and assigning no classifications or defaults to the Event. Omitted term claims SHALL preserve current assignments.

#### Scenario: A later extraction omits a known term
- **WHEN** a model answer does not mention a previously accepted genre
- **THEN** the run preserves that assignment

#### Scenario: Model removes an edition term
- **WHEN** the model explicitly proposes removing an assigned term from a specific Occurrence
- **THEN** the writer removes that assignment from that Occurrence only, preserving sibling editions' assignments

### Requirement: Topics remain independent of physical format

Topic assignments SHALL describe programme content or participant offerings independently of the physical format. A topic assignment SHALL NOT substitute for a format assignment required by publication rules. Specific topic definitions and assignment guidance SHALL remain curated vocabulary rather than fixed specification requirements.

#### Scenario: Additional topics without an eligible format

- **GIVEN** an edition with additional topic assignments but no eligible physical format
- **WHEN** publication is attempted
- **THEN** those topics do not satisfy the publication format gate
