# Spec Delta

## MODIFIED Requirements

### Requirement: Findings alone do not authorize writes

Ingestion changes SHALL require validated editor and, for accepted Edition targets, Location proposals. The editor SHALL assess identity and non-location changes. Location SHALL assess the complete place block under [location resolution](../location-resolution/spec.md). The application SHALL validate ownership, slots, country, fields, and catalog rules. It SHALL trust each owning agent's assessment of meaning without an independent semantic evidence check. Failed research, failed required editing or Location, or invalid plans SHALL produce no writes. Raw findings SHALL NOT be a fallback.

#### Scenario: A finding concerns the wrong Edition

- **WHEN** the editor identifies evidence for an earlier Edition as the basis for a current date change
- **THEN** the saved value remains unchanged and the mismatch is explained

#### Scenario: No valid update proposal is available

- **WHEN** research succeeds but no valid update proposal is available
- **THEN** no catalog operations are made and the run retains the findings and failure

#### Scenario: A structurally invalid update is proposed

- **WHEN** an update would violate catalog or publication constraints
- **THEN** the whole item is rejected without partial catalog or audit changes

### Requirement: Field changes require matching findings

Non-location changes or clears SHALL require a research finding for the same owner, Edition key, and field. The editor SHALL assess its support and MAY transform it into a valid value. Location changes SHALL follow the evidence and point-reference rules in [location resolution](../location-resolution/spec.md). The application SHALL validate support references, actions, reasons, ownership, and catalog rules. A missing basis or invalid proposal SHALL reject the whole item and retain the reason.

#### Scenario: An update lacks a finding

- **WHEN** an editor update names a non-location field without a finding for that owner, Edition key where applicable, and field
- **THEN** the whole proposal is rejected before catalog operations

#### Scenario: An update targets the wrong Event

- **WHEN** research is usable but the editor rejects an update as belonging to another Event
- **THEN** no writes occur and the report preserves the rejection reason and failed catalog outcome separately from research status

#### Scenario: Coordinates come from a geocoding candidate

- **WHEN** Location selects a registered candidate for a supported target venue
- **THEN** the point reference and Location evidence can authorize the coordinate action without a separate research coordinate finding
- **AND** the editor does not approve the point a second time

### Requirement: Omission and uncertainty preserve saved values

An omitted or unknown research field SHALL NOT authorize a change to its saved value or a claim of verification. Neither agent SHALL clear a value because of retrieval failure or source silence. The owner of a field MAY propose a clear when supplied evidence disproves it and catalog rules permit it. Location SHALL apply this rule to the complete place block and express preservation with an explicit keep action. Supported changes MAY proceed alongside unrelated uncertainty.

#### Scenario: The source omits a saved price

- **WHEN** a failed or incomplete source read yields no supported replacement ticket block
- **THEN** the saved ticket block remains unchanged

#### Scenario: A venue is explicitly withdrawn

- **WHEN** inspected organizer evidence disproves the saved venue without naming a replacement
- **THEN** a supported update may clear it with an explanation, subject to catalog constraints

#### Scenario: Dates change while tickets remain unknown

- **WHEN** evidence supports corrected dates but ticket information is unavailable
- **THEN** the dates may change while saved tickets remain and the ticket question is reported

#### Scenario: A new venue invalidates the saved point

- **WHEN** Location accepts a supported new venue and evidence establishes that the target point belongs to the withdrawn venue
- **THEN** Location explicitly clears that point if no replacement is supported
- **AND** ordinary missing coordinate information alone would not authorize that clear

### Requirement: Proposed changes have an attributable basis

Every changed or cleared fact SHALL have a reason grounded in supplied evidence or saved state and retain its owner and Edition key. New records SHALL have an identity or creation explanation. Location decisions SHALL retain registered point or donor references as applicable; supplied source summaries remain in the input and report without citations in Location output. Unchanged saved entries SHALL NOT require fresh citations. An unsupported explanation SHALL NOT bypass validation.

#### Scenario: A venue changes

- **WHEN** research proposes a new venue for a saved Edition
- **THEN** the proposed change identifies that Edition, its new value, and why the source supports it

#### Scenario: A classification replacement retains saved terms

- **WHEN** a supported classification change retains some saved terms
- **THEN** those terms need no new source claim, while new or changed terms retain their basis

### Requirement: Field groups remain complete and owned

Dates, coordinates, tickets, and classification SHALL follow their complete-group or replacement rules. Location SHALL own the venue, address, locality, administrative area, country, and coordinates together. Omitted editor actions SHALL preserve saved values. Location SHALL return explicit decisions for all its fields, including keep actions for preserved values. One Edition SHALL NOT change a sibling. Invalid owners, targets, types, overlapping field ownership, missing Location actions, or incomplete replacements SHALL reject the item before writing.

#### Scenario: A date correction

- **WHEN** an Edition date range changes
- **THEN** the proposal supplies a complete start and end pair for that Edition

#### Scenario: A field is omitted

- **WHEN** the editor changes an Edition name and omits tickets without evidence that the saved tickets are wrong
- **THEN** tickets remain unchanged

#### Scenario: A location field is preserved

- **WHEN** Location changes venue and returns keep for locality without evidence that the saved locality is wrong
- **THEN** locality remains unchanged

### Requirement: Research and editing use fixed Edition roles

Non-null research data and ready editor plans MUST contain previousEdition and currentOrNextEdition. Each slot MUST contain one keyed Edition or null; arrays MUST be rejected. Editor slots MUST be null or match the same research slot. During ingestion, Location MUST match every accepted editor slot and keep declined slots null. One key MUST NOT occupy both roles. A null editor slot MUST preserve saved state and skip its Location work and publication evaluation.

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

#### Scenario: Location restores a declined Edition

- **WHEN** Location supplies a non-null slot that the editor declined
- **THEN** validation rejects the whole item before writes
