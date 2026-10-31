## MODIFIED Requirements

### Requirement: Existing Event identity remains stable during refresh
Refresh and duplicate add SHALL not rename an existing Event or change its aliases or slug from a source suggestion. The system SHALL compare trimmed names case-sensitively and retain differences as private `eventNameMismatch` metadata with Event ID and original stored and observed names. A mismatch SHALL not change status, exit code, update eligibility, or audit.

#### Scenario: A source uses a different name
- **WHEN** ingestion observes a name differing from the targeted Event
- **THEN** the stored name, aliases, and slug remain and `eventNameMismatch` reports the original names and Event ID without changing outcome or audit

#### Scenario: Name differs during a no-op or later failure
- **WHEN** a differing observed name accompanies a duplicate add, preview, no-op, or later write failure
- **THEN** CLI text and private structured reports retain the mismatch independently of the catalog outcome

#### Scenario: Names match after trimming
- **WHEN** stored and observed names differ only in surrounding whitespace or no existing Event is resolved
- **THEN** `eventNameMismatch` is absent

#### Scenario: A new Event has a supported identity

- **WHEN** add establishes a new Event rather than a duplicate
- **THEN** the new record has a supported Event name and creation reason
- **AND** no unsupported name is substituted

### Requirement: Partial research identifies known unfinished checks

Ingestion SHALL report partial research when useful evidence remains with a known unfinished mandatory check. It SHALL identify that check and preserve unsupported fields. Missing optional facts or an unannounced next Edition alone SHALL NOT require partial status. Omission SHALL NOT imply completed verification. A hard limit without a usable result SHALL follow [ingestion runs](../ingestion-runs/spec.md).

#### Scenario: A mandatory check is blocked
- **WHEN** inspected sources support some findings but an assigned source cannot be checked
- **THEN** research is partial, identifies the unfinished check, and preserves affected saved values

### Requirement: Findings alone do not authorize writes

Catalog changes SHALL require a valid, supported update for the selected Event and Editions. Ingestion SHALL check identity, scope, field meaning, country, and catalog constraints. Exact quotation matching SHALL NOT prove semantic support. A required execution failure or invalid final update SHALL produce no item writes. Raw findings SHALL NOT bypass validation.

#### Scenario: A finding concerns the wrong Edition

- **WHEN** ingestion identifies evidence for an earlier Edition as the basis for a current date change
- **THEN** the saved value remains unchanged and the mismatch is explained

#### Scenario: No valid update proposal is available

- **WHEN** source checks succeed but no valid required update result is available
- **THEN** no catalog operations are made and the run retains the findings and failure

#### Scenario: A structurally invalid update is proposed

- **WHEN** an update would violate catalog or publication constraints
- **THEN** the whole item is rejected without partial catalog or audit changes

### Requirement: Field changes require matching findings

Each changed or cleared field SHALL have a basis for the same owner, Edition key, and field. Coordinates SHALL follow [location resolution](../location-resolution/spec.md). Missing support, invalid references, or invalid ownership SHALL reject the item before writes and retain a reason.

#### Scenario: An update lacks a finding

- **WHEN** a proposed change lacks a matching target or attributable basis
- **THEN** the whole proposal is rejected before catalog operations

#### Scenario: An update targets the wrong Event

- **WHEN** research is usable but ingestion rejects an update as belonging to another Event
- **THEN** no writes occur and the report preserves the rejection reason and failed catalog outcome separately from research status

#### Scenario: Coordinates come from a geocoding candidate

- **WHEN** a checked geocoding candidate is selected for a supported target venue
- **THEN** the retained candidate and supporting evidence establish the coordinate basis
- **AND** the resulting place description still meets the location and catalog rules

### Requirement: Proposed changes have an attributable basis

Every changed or cleared fact SHALL retain its target, reason, and source or saved-state basis. New records SHALL have identity or creation reasons. Coordinate changes SHALL retain their source point, geocoding candidate, or earlier saved point basis. Retained saved values SHALL NOT require fabricated fresh evidence. A page description alone SHALL NOT authorize a change.

#### Scenario: A venue changes

- **WHEN** ingestion proposes a new venue for a saved Edition
- **THEN** the proposed change identifies that Edition, its new value, and why the source supports it

#### Scenario: A classification replacement retains saved terms

- **WHEN** a supported classification change retains some saved terms
- **THEN** those terms need no new source claim, while new or changed terms retain their basis

### Requirement: Field groups remain complete and owned

Dates, tickets, and classification SHALL follow their complete-group or replacement rules. The final venue, address, locality, administrative area, country, and point SHALL describe one coherent place. Omission SHALL preserve saved values unless evidence supports removal. One Edition SHALL NOT change a sibling. Invalid targets, types, or incomplete replacements SHALL reject the item.

#### Scenario: A date correction

- **WHEN** an Edition date range changes
- **THEN** the proposal supplies a complete start and end pair for that Edition

#### Scenario: A field is omitted

- **WHEN** ingestion updates an Edition name without a supported ticket replacement
- **THEN** tickets remain unchanged

#### Scenario: A location field is preserved

- **WHEN** ingestion changes the venue and preserves locality without evidence that the saved locality is wrong
- **THEN** locality remains unchanged

#### Scenario: A complete ticket proposal is rejected
- **WHEN** a complete ticket replacement is rejected
- **THEN** the saved price block, including any existing offer URLs, remains unchanged
- **AND** no part of the rejected block is written separately

#### Scenario: A new venue invalidates its old address and point
- **WHEN** a supported place change includes a new venue and supported removal of its old address and point
- **THEN** the result does not combine the new venue with those disproved saved values

### Requirement: Supported ticket prices replace observed offers

Only currentOrNextEdition, including an ongoing Edition, SHALL be eligible for ticket updates. A supported price SHALL permit a complete replacement with offers observed in that check, without unchecked saved offers. Unfinished offer checks SHALL remain visible. Without a supported price, ingestion SHALL preserve the saved block. Availability or sales closure alone SHALL NOT replace it. Historical tickets and their URLs SHALL remain unchanged.

#### Scenario: A saved offer cannot be checked
- **GIVEN** saved Regular and Student offers
- **WHEN** a current source supports a new Regular price but Student checkout cannot be read
- **THEN** the replacement includes Regular without the unverified Student offer
- **AND** the Student check remains unfinished in the report

#### Scenario: An observed category has availability but no amount
- **WHEN** a supported price permits replacement and another observed category has known availability without a price
- **THEN** the replacement may include that category without amount or currency

#### Scenario: No price is supported
- **WHEN** relevant pages have no readable price or only announce closed sales
- **THEN** the saved ticket block remains unchanged

#### Scenario: Only historical tickets are found
- **WHEN** collection finds prices for previousEdition but no current-or-next ticket evidence
- **THEN** historical ticket blocks and their URLs remain unchanged
- **AND** the historical omission is not an unfinished assigned check

### Requirement: Official link findings preserve ownership

Official links SHALL be valid HTTP(S) destinations supported for their Event or Edition and link kind. Omitted or unverified links SHALL preserve saved slots. Removal SHALL need affirmative evidence. Ticket links SHALL change only for currentOrNextEdition. When established, the Edition ticket overview SHALL be used for its ticket slot. An inspected page SHALL NOT become an official link merely because it was read.

#### Scenario: An Edition has its own ticket link
- **WHEN** inspected evidence establishes an Edition-specific ticket destination
- **THEN** the proposal associates it with that Edition rather than the Event's shared links

#### Scenario: A saved link cannot be read
- **WHEN** automated retrieval of a saved social link is unsupported
- **THEN** that limitation alone does not clear the link

#### Scenario: One social account is replaced
- **WHEN** evidence supports replacing an Event's X or Twitter account
- **THEN** only its `x` slot, labelled X (Twitter), changes and the Event's other social accounts remain; unchanged saved URLs retain their spelling

#### Scenario: One Edition ticket link is removed
- **WHEN** inspected evidence disproves currentOrNextEdition's ticket destination and supports its removal
- **THEN** only that Edition's ticket slot is cleared and sibling Edition links remain

#### Scenario: Ticket overview and product pages coexist
- **WHEN** an official source establishes a ticket overview and individual product pages
- **THEN** the Edition ticket slot uses the overview
- **AND** ingestion does not create per-offer URL associations

#### Scenario: Only a product destination is established
- **WHEN** an official source establishes one booking destination for the selected Edition and no supported overview
- **THEN** ingestion can use that destination for the Edition ticket slot without inventing an overview URL

#### Scenario: Checkout is unreadable
- **WHEN** an inspected official page establishes the selected Edition's ticket link but checkout cannot be read
- **THEN** the link can be proposed independently of prices or availability

#### Scenario: A candidate is a source or a map
- **WHEN** an inspected page links to a news article, map, or unrelated same-brand event
- **THEN** ingestion does not place that URL in a public official-link slot without the required owner and purpose evidence

#### Scenario: Historical ticket URLs are present
- **WHEN** ingestion encounters a ticket URL for previousEdition
- **THEN** that historical slot and its offer URLs remain unchanged

## ADDED Requirements

### Requirement: Ticket replacements omit per-offer URLs

Ingestion ticket proposals and accepted replacements SHALL omit per-offer URL fields. A supported complete replacement SHALL replace the saved price block without those fields. Without an accepted replacement, saved offers and their existing URLs SHALL remain unchanged. The Edition ticket link SHALL be a separate update and SHALL NOT require a price replacement.

#### Scenario: A current price replacement is accepted

- **WHEN** supported current-or-next prices permit an accepted complete ticket replacement
- **THEN** the new saved block contains no per-offer URLs
- **AND** ingestion does not copy URLs from the old block into the replacement

#### Scenario: No supported replacement is available

- **WHEN** no complete ticket replacement is accepted
- **THEN** saved offers and their existing URLs remain unchanged
- **AND** an independently supported Edition ticket link can still change

### Requirement: Ingestion uses fixed Edition roles

The result MUST distinguish previousEdition and currentOrNextEdition, each with one supported key or null. One key MUST NOT occupy both roles. Accepted changes MUST retain their selected keys and roles. A declined or unresolved target MUST preserve saved state and skip creation and publication. Missing roles, invalid targets, or inconsistent final changes MUST reject the item.

#### Scenario: Both roles have supported findings

- **WHEN** evidence supports a completed Edition and a distinct current or next Edition
- **THEN** the result identifies each in its named role
- **AND** changes to both are applied in one atomic item

#### Scenario: One Edition is declined

- **WHEN** one selected Edition is unsupported and the other has a valid update
- **THEN** only the accepted Edition enters operation and publication evaluation
- **AND** declining a target does not clear, withdraw, or delete a saved Edition

#### Scenario: A required slot is missing

- **WHEN** the final result omits a required Edition role or supplies an Edition array
- **THEN** the item is rejected before writes

#### Scenario: An update changes the selected key or role

- **WHEN** the final update addresses another key, swaps roles, or addresses an unselected Edition
- **THEN** the whole item is rejected, including preservation-only actions

#### Scenario: Slot null differs from a disproven field

- **WHEN** the result has a null Edition slot
- **THEN** it means no selected Edition for that role
- **AND** it does not clear a saved field
- **AND** unresolved questions distinguish an absent Edition from unfinished selection

#### Scenario: A place update addresses a declined Edition

- **WHEN** the final update includes a place change for a declined target
- **THEN** the whole item is rejected before writes

#### Scenario: A temporal premise is rejected

- **WHEN** a date or identity premise used to select a target or earlier saved Edition is rejected
- **THEN** changes that rely on it are not applied or silently reassigned

#### Scenario: An accepted target has no field changes

- **WHEN** the selected target is supported but its proposed field changes are declined
- **THEN** preserved saved content still follows normal publication evaluation for that target
- **AND** a new target still requires a valid creation reason and catalog validation

## REMOVED Requirements

### Requirement: Research and editing use fixed Edition roles

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Ingestion uses fixed Edition roles" retains the domain checks. Internal contracts belong in the design.
