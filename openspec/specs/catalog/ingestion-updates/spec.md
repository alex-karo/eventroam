# Ingestion updates

## Purpose

Define when source-backed findings can change catalog facts and how uncertain, incomplete, or invalid proposals preserve existing data.

## Requirements

### Requirement: Research status is independent of catalog mutation
Research SHALL report success, partial, or failure separately from the catalog outcome. Success SHALL mean that the research operation succeeded. It SHALL NOT certify that every assigned check was complete. Research MAY succeed without catalog changes. The research model SHALL NOT treat an unverified saved value as a new finding.

#### Scenario: Assigned checks confirm saved facts
- **WHEN** inspected sources complete the assignment and support the saved values
- **THEN** research may succeed while the catalog remains unchanged

### Requirement: Partial research identifies known unfinished checks

Ingestion SHALL report partial research when useful evidence remains with a known unfinished mandatory check. It SHALL identify that check and preserve unsupported fields. Missing optional facts or an unannounced next Edition alone SHALL NOT require partial status. Omission SHALL NOT imply completed verification. A hard limit without a usable result SHALL follow [ingestion runs](../ingestion-runs/spec.md).

#### Scenario: A mandatory check is blocked
- **WHEN** inspected sources support some findings but an assigned source cannot be checked
- **THEN** research is partial, identifies the unfinished check, and preserves affected saved values

#### Scenario: A source gap remains after a useful interpretation

- **WHEN** useful evidence supports a field proposal but another relevant required source is blocked, unread or unprocessed
- **THEN** research remains partial and identifies that source gap even if the field check is verified

#### Scenario: Collected evidence needs interpretation

- **WHEN** relevant source collection is complete and an assigned interpretation check remains unresolved
- **THEN** research remains partial and identifies that interpretation gap
- **AND** missing optional prose or fresh genre names alone does not require another source

#### Scenario: An unassigned historical check remains unfinished

- **WHEN** current scope completes its assigned checks and a role also returns an unfinished historical check
- **THEN** that extra check alone does not make research partial
- **AND** any missing or unfinished assigned check still makes useful research partial

### Requirement: Failed research makes no catalog changes
Failed research SHALL have no usable findings and SHALL produce no catalog operations.

#### Scenario: No usable findings remain
- **WHEN** all relevant reads fail and no inspected evidence supports a result
- **THEN** research fails without an invented candidate or catalog operation

### Requirement: Errors and unanswered questions remain distinct
The run SHALL distinguish bounded execution errors from factual questions that could not be resolved. Errors SHALL identify their stage and may identify the affected source or target without exposing credentials or provider payloads. An ordinary unanswered question SHALL NOT veto an independent valid change. A country conflict or invalid update SHALL remain a rejecting validation error.

#### Scenario: A source fails but other evidence is useful
- **WHEN** one source fails and another supports an in-scope update
- **THEN** the failed read is reported separately from the supported finding

#### Scenario: A provider fails before a result
- **WHEN** model execution fails before usable findings exist
- **THEN** no catalog changes are made and a safe execution error is reported

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

Every changed or cleared fact SHALL retain its target, reason, and source or saved-state basis. New records SHALL have identity or creation reasons. Coordinate changes SHALL retain their source point, geocoding candidate, or earlier saved point basis. Retained saved values SHALL NOT require fabricated fresh evidence. A page description alone SHALL NOT authorize a change.

#### Scenario: A venue changes

- **WHEN** ingestion proposes a new venue for a saved Edition
- **THEN** the proposed change identifies that Edition, its new value, and why the source supports it

#### Scenario: A classification replacement retains saved terms

- **WHEN** a supported classification change retains some saved terms
- **THEN** those terms need no new source claim, while new or changed terms retain their basis

### Requirement: Field groups remain complete and owned

Dates, tickets, and classification SHALL follow their complete-group or replacement rules. The final venue, address, locality, administrative area, country, and point SHALL describe one coherent place. Omission SHALL preserve saved values unless evidence supports removal. One Edition SHALL NOT change a sibling. An invalid target SHALL reject the item. An invalid type or incomplete replacement in the final result SHALL also reject the item.

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

### Requirement: Research preserves catalog time zones
Research SHALL NOT propose time-zone changes. An existing Edition's time zone SHALL survive ingestion updates; a new Edition SHALL use the catalog's existing fallback when no zone is supplied by the catalog operation.

#### Scenario: An existing Edition changes dates
- **WHEN** research supports a new programme date range
- **THEN** the saved time zone remains unchanged

### Requirement: Ticket findings preserve price meaning
Ticket availability SHALL belong to each ticket variant, independently of schedule status. A proposed ticket replacement SHALL keep variant coverage, conditions, currency, and the intended base full-programme price distinct from day, package, or concession prices. Amounts SHALL use the catalog's currency precision. An unavailable price MAY coexist with a verified official ticket link. Structurally incomplete or invalid monetary proposals SHALL not change the saved price block.

#### Scenario: Categories have different availability
- **WHEN** one ticket category is sold out and another is available
- **THEN** findings retain those separate statuses without cancelling the Edition

#### Scenario: A concession is cheaper than general admission
- **WHEN** only a concession or day ticket has a lower amount
- **THEN** it does not become the base full-programme admission price

### Requirement: Supported ticket prices replace observed offers

Only currentOrNextEdition, including an ongoing Edition, SHALL be eligible for ticket updates. A supported price SHALL permit a complete replacement with offers observed in that check, without unchecked saved offers. Unfinished offer checks SHALL remain visible. Without a supported price, ingestion SHALL preserve the saved block. Explicitly supported free full-programme admission SHALL permit an empty offer list when no ticket categories are published. Other replacements SHALL require at least one observed offer. The free claim SHALL retain source evidence and pass Editor review. Availability or sales closure alone SHALL NOT replace it. Historical tickets and their URLs SHALL remain unchanged.

#### Scenario: A saved offer cannot be checked
- **GIVEN** saved Regular and Student offers
- **WHEN** a current source supports a new Regular price but Student checkout cannot be read
- **THEN** the replacement includes Regular without the unverified Student offer
- **AND** the Student check remains unfinished in the report

#### Scenario: An observed category has availability but no amount
- **WHEN** a supported price permits replacement and another observed category has known availability without a price
- **THEN** the replacement may include that category without amount or currency

#### Scenario: A category name refers to unread offer details

- **WHEN** a current source supports a Regular price and names a Student category whose details are only in an unread checkout
- **THEN** the replacement includes Regular without a Student placeholder, even with an absent amount and currency
- **AND** the Student question remains unresolved
- **AND** a proposed replacement that includes that unsupported placeholder is rejected as a complete ticket block
- **AND** a category present only in saved state, source mentions or unresolved questions is not part of a new replacement and does not invalidate it

#### Scenario: Free admission has no ticket categories

- **WHEN** source evidence explicitly establishes free full-programme admission for currentOrNextEdition without ticket categories
- **THEN** a reviewed replacement can contain a free base price and an empty offer list
- **AND** it does not invent an offer or copy unchecked saved offers

#### Scenario: An empty list has no supported free admission

- **WHEN** a ticket proposal has no offers and its base price is unknown or paid
- **THEN** validation rejects that proposal

#### Scenario: No price is supported
- **WHEN** relevant pages have no readable price or only announce closed sales
- **THEN** the saved ticket block remains unchanged

#### Scenario: Only historical tickets are found
- **WHEN** collection finds prices for previousEdition but no current-or-next ticket evidence
- **THEN** historical ticket blocks and their URLs remain unchanged
- **AND** the historical omission is not an unfinished assigned check

#### Scenario: A published offer has unresolved currency

- **WHEN** an inspected source publishes a numeric ticket price but its currency cannot be established
- **THEN** the observed offer can omit both amount and currency with basePrice null only if its terms retain the literal published price and unresolved currency
- **AND** Editor does not require separate availability or admission terms merely because that currency is unresolved
- **AND** a category label or unread link without price evidence still does not establish an observed offer

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

### Requirement: Existing Event identity remains stable during refresh
Refresh and duplicate add SHALL not rename an existing Event or change its aliases or slug from a source suggestion. The system SHALL compare trimmed names case-sensitively and retain differences as private `eventNameMismatch` metadata with Event ID and original stored and observed names. A mismatch SHALL not change status, exit code, update eligibility, or audit.

#### Scenario: A source uses a different name
- **WHEN** research returns a name differing from the targeted Event
- **THEN** the stored name, aliases, and slug remain and `eventNameMismatch` reports the original names and Event ID without changing outcome or audit

#### Scenario: Name differs during a no-op or later failure
- **WHEN** a differing observed name accompanies a duplicate add, preview, no-op, or later write failure
- **THEN** CLI text and private structured reports retain the mismatch independently of the catalog outcome

#### Scenario: Names match after trimming
- **WHEN** stored and observed names differ only in surrounding whitespace or no existing Event is resolved
- **THEN** `eventNameMismatch` is absent

### Requirement: Refresh preserves Event and Edition ownership
A proposed new Edition SHALL match the targeted Event and a supported Edition key. Omission of a saved Edition SHALL leave it untouched. Entity deletion and reassignment SHALL not result from ingestion.

#### Scenario: A saved Edition is omitted
- **WHEN** an update proposal does not address a saved Edition
- **THEN** that Edition is neither changed nor considered for publication by the proposal

### Requirement: Size findings reflect participant evidence
An Edition size estimate SHALL describe approximate participant scale and explain its basis. Relevant historical attendance MAY inform a later Edition. Maximum occupancy alone, unsupported numbers, or repeated daily admissions without a supported participant interpretation SHALL NOT establish size. Missing size after completed checks SHALL NOT alone make research partial.

#### Scenario: Attendance and capacity differ
- **WHEN** sources support approximately 8,000 participants and a maximum occupancy of 20,000
- **THEN** the estimate may use 8,000 with its attendance basis explained

#### Scenario: Participant evidence is insufficient
- **WHEN** inspected sources provide no supportable participant count
- **THEN** size is omitted and any saved value is preserved

### Requirement: Research and editing use fixed Edition roles

The result MUST distinguish previousEdition and currentOrNextEdition, each with one supported key or null. One key MUST NOT occupy both roles. Accepted changes MUST retain their selected keys and roles. A declined or unresolved target MUST preserve saved state and skip creation and publication. Missing roles, invalid targets, or inconsistent final changes MUST reject the item.

#### Scenario: Both roles have supported findings

- **WHEN** evidence supports a completed Edition and a distinct current or next Edition
- **THEN** the result identifies each in its named role
- **AND** changes to both are applied in one atomic item

#### Scenario: The editor declines one Edition

- **WHEN** one selected Edition is unsupported and the other has a valid update
- **THEN** only the accepted Edition enters operation and publication evaluation
- **AND** declining a target does not clear, withdraw, or delete a saved Edition

#### Scenario: A required slot is missing

- **WHEN** the final result omits a required Edition role or supplies an Edition array
- **THEN** the item is rejected before writes

#### Scenario: Editor changes the selected key or role

- **WHEN** the final update addresses another key, swaps roles, or addresses an unselected Edition
- **THEN** the whole item is rejected, including preservation-only actions

#### Scenario: Slot null differs from a disproven field

- **WHEN** the result has a null Edition slot
- **THEN** it means no selected Edition for that role
- **AND** it does not clear a saved field
- **AND** unresolved questions distinguish an absent Edition from unfinished selection

#### Scenario: Location restores a declined Edition

- **WHEN** the final update includes a place change for a declined target
- **THEN** the whole item is rejected before writes

#### Scenario: A temporal premise is rejected

- **WHEN** a date or identity premise used to select a target or earlier saved Edition is rejected
- **THEN** changes that rely on it are not applied or silently reassigned

#### Scenario: An accepted target has no field changes

- **WHEN** the selected target is supported but its proposed field changes are declined
- **THEN** preserved saved content still follows normal publication evaluation for that target
- **AND** a new target still requires a valid creation reason and catalog validation

### Requirement: Ingestion schedule status follows programme dates

For a supported Edition announcement, ingestion SHALL use `scheduled` with a complete programme date range and `announced` without one. This SHALL include provisional dates. `dateState` SHALL retain date certainty separately. An explicit cancellation or postponement SHALL take priority. Missing dates alone SHALL NOT establish cancellation or postponement. These rules SHALL apply to the selected supported Edition; they SHALL NOT authorize changes to unchecked saved Editions.

#### Scenario: An announcement has provisional dates

- **WHEN** a selected supported Edition has a complete provisional programme date range
- **THEN** ingestion uses `scheduled` and retains `dateState: provisional`

#### Scenario: An announcement has no complete date range

- **WHEN** a selected supported Edition is announced without a complete programme date range
- **THEN** ingestion uses `announced` without inventing dates

#### Scenario: An explicit exception applies

- **WHEN** inspected evidence explicitly cancels or postpones a selected Edition
- **THEN** that status takes priority over the presence of saved or published dates

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

### Requirement: The group owner supplies revised values

Only the assigned group owner SHALL supply a revised value or fill a returned omission. A revised proposal SHALL pass the same checks as an original proposal. If Editor supplies a replacement value, the item SHALL fail before writes.

#### Scenario: The ticket link points to an archive

- **WHEN** Links supplies an archived ticket link and a saved official page explicitly identifies the ticket overview for the selected Edition
- **THEN** Editor can return the link group to Links with the saved passage, even if Reader did not extract it
- **AND** Links can propose the URL with its source support
- **AND** an accepted correction changes only that Edition's ticket link

#### Scenario: Editor acts on one of several omissions

- **WHEN** several assigned fields have no proposal, each still has its return, and Editor has evidence for just the ticket link
- **THEN** Editor can return that omission to Links and review every submitted proposal without giving decisions for the other omissions
- **AND** the saved values of those other fields are preserved

#### Scenario: An omission is outside the assignment

- **WHEN** a current refresh has no proposal for a historical ticket, an Event website or either Event description
- **THEN** Editor cannot return those groups, even if it finds the values on a saved page
