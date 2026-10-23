# Spec Delta

## MODIFIED Requirements

### Requirement: Findings alone do not authorize writes
Catalog changes SHALL require an editor proposal based on research findings and saved state. The editor SHALL assess factual support and whether each proposed change fits its finding. The application SHALL validate target ownership, Edition slot bounds, country, field structure, and catalog rules before writing. It SHALL trust the editor's assessment of meaning without an independent evidence check. Failed research, an invalid proposal, or failed validation SHALL produce no writes. Findings alone SHALL NOT be applied as a fallback.

#### Scenario: A finding concerns the wrong Edition
- **WHEN** the editor identifies evidence for an earlier Edition as the basis for a current date change
- **THEN** the saved value remains unchanged and the mismatch is explained

#### Scenario: No valid update proposal is available
- **WHEN** research succeeds but no valid update proposal is available
- **THEN** no catalog operations are made and the run retains the findings and failure

#### Scenario: A structurally invalid update is proposed
- **WHEN** an update would violate catalog or publication constraints
- **THEN** the whole item is rejected without partial catalog or audit changes

## ADDED Requirements

### Requirement: Research and editing use fixed Edition roles

Non-null research data and ready editor plans MUST contain `previousEdition` and `currentOrNextEdition`.
Each slot MUST contain one keyed Edition or null. Edition result arrays MUST be rejected.
An editor slot MUST be null or address the key from the same research slot.
One key MUST NOT occupy both roles. A null editor slot MUST preserve saved state and skip publication for that Edition.

#### Scenario: Both roles have supported findings

- **WHEN** research selects a completed Edition and a distinct current or next Edition
- **THEN** it returns each in its named slot
- **AND** the editor can update or create each independently within one atomic item

#### Scenario: The editor declines one Edition

- **WHEN** the editor returns null for one research slot and a valid plan for the other
- **THEN** only the addressed Edition enters operation and publication evaluation
- **AND** the null slot does not clear, withdraw, or delete a saved Edition

#### Scenario: A required slot is missing

- **WHEN** non-null research data or a ready plan omits either Edition slot or supplies an Edition array
- **THEN** validation rejects the item before writes

#### Scenario: Editor changes the selected key or role

- **WHEN** an editor slot uses another key, swaps roles, or addresses a saved Edition absent from that research slot
- **THEN** the host rejects the whole plan, including preservation-only actions

#### Scenario: Slot null differs from a disproven field

- **WHEN** research returns a null Edition slot
- **THEN** null means no selected finding for that role
- **AND** it differs from a field finding with `value:null`, which requires evidence that disproves a saved value
- **AND** unresolved questions distinguish an absent Edition from unfinished selection
