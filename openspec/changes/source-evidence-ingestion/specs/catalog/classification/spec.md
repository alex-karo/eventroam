## MODIFIED Requirements

### Requirement: Ingestion classification updates are edition-specific

Ingestion MUST use a complete classification list for each changed Edition. It MUST retain unchallenged saved terms and normalize redundant ancestors before replacement. The change MUST NOT create Event defaults or affect sibling Editions. An omitted or rejected replacement MUST preserve saved assignments.

#### Scenario: A later check omits a known term

- **WHEN** new evidence does not mention or refute a saved term
- **THEN** ingestion retains it in the complete list or omits classification
- **AND** removing a redundant ancestor follows the normalization rule below

#### Scenario: An edition term is removed

- **WHEN** evidence refutes an assigned term and an accepted complete list excludes it
- **THEN** the writer removes that assignment from that Edition only
- **AND** sibling Editions retain their assignments

### Requirement: Current research can explicitly reuse preceding classification

For a new selected current Edition, ingestion SHALL assess inspected announcement evidence before reusing a preceding comparable saved Edition's classification. The complete replacement SHALL identify that earlier Edition and continuity basis. Refuted terms SHALL be revised or excluded. Ambiguous comparability SHALL NOT authorize copying. Omission SHALL NOT trigger inheritance.

#### Scenario: Programme continuity supports reuse
- **WHEN** inspected announcements support continuity with a preceding comparable Edition of the same Event
- **THEN** its supplied term IDs may be proposed with the earlier Edition's key and continuity explanation.

#### Scenario: The programme or format changes
- **WHEN** current evidence refutes programme or format terms from the earlier Edition
- **THEN** exclude them, retain unchallenged comparable terms and use only supported supplied replacements.

#### Scenario: A chronological neighbor is not comparable
- **WHEN** the nearest predecessor has a different weekend/programme and comparability remains unverified
- **THEN** do not copy by date/year alone; classify from current evidence or omit with any unfinished assessment in unresolved.

#### Scenario: Reuse is omitted or rejected
- **WHEN** classification is omitted or proposed reuse is rejected
- **THEN** infer no sibling taxonomy or Event default; normal publication gates still apply.

### Requirement: Ingestion removes redundant classification ancestors

For an accepted complete classification proposal, ingestion MUST remove each selected term with a selected descendant at any depth.
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

- **WHEN** the classification replacement is rejected or no proposal is supplied
- **THEN** ingestion preserves saved assignments without normalization writes

#### Scenario: An invalid list reaches preparation

- **WHEN** the list contains an unknown ID, duplicate ID, or excess terms in a single-valued facet
- **THEN** ingestion rejects the item without writes
- **AND** ancestor normalization does not hide the invalid input

#### Scenario: A direct write bypasses ingestion preparation

- **WHEN** a catalog assignment operation contains an ancestor and its descendant
- **THEN** the writer rejects it without assignment, version, or audit changes

## ADDED Requirements

### Requirement: Event type follows programme meaning

`gathering` MUST mean a main programme created through participants' contributions. Community wording alone MUST NOT establish that type. If both types fit and the organizer explicitly calls the Edition a festival, ingestion MUST prefer `festival`. Classification MUST obey the catalog's facet limits.

#### Scenario: A festival also describes a community gathering

- **WHEN** the organizer calls an Edition a festival with music, workshops, and a community gathering
- **THEN** ingestion uses festival as its only event type

#### Scenario: Facet limits apply

- **WHEN** a complete classification is validated
- **THEN** event_type and format each contain at most one term
- **AND** topic, genre, and culture can contain multiple terms

### Requirement: Classification count conflicts preserve valid results

Ingestion MUST NOT apply a classification list with excess facet terms. A supported replacement MUST be complete. If evidence cannot resolve the type, ingestion MUST preserve saved classification and report the question. An invalid final list MUST produce no item writes.

#### Scenario: A final list has two event types

- **WHEN** the final classification contains both festival and gathering
- **THEN** validation rejects the item without catalog operations

#### Scenario: A supported complete list resolves the ambiguity

- **WHEN** source evidence supports festival as the only event type
- **THEN** a complete supported list with that type can replace the saved classification

#### Scenario: Evidence does not resolve the type

- **WHEN** inspected evidence cannot establish an event type
- **THEN** no unsupported replacement is applied and the question remains visible

## REMOVED Requirements

### Requirement: Models share facet limits and event type guidance

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Event type follows programme meaning" retains the domain checks. Internal contracts belong in the design.

### Requirement: The editor resolves classification count conflicts

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Classification count conflicts preserve valid results" retains the domain checks. Internal contracts belong in the design.
