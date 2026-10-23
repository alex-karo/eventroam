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
The research model SHALL report partial research when it returns useful findings with a known unfinished mandatory check. It SHALL identify that check. Missing optional facts or an unannounced next Edition alone SHALL NOT require partial status. The application SHALL NOT infer check completion from omitted fields. A hard limit without a usable result SHALL follow the failure rules in [ingestion runs](../ingestion-runs/spec.md).

#### Scenario: A mandatory check is blocked
- **WHEN** inspected sources support some findings but an assigned source cannot be checked
- **THEN** research is partial, identifies the unfinished check, and preserves affected saved values

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
Catalog changes SHALL require an editor proposal based on research findings and saved state. The editor SHALL assess factual support and whether each proposed change fits its finding. The application SHALL validate target ownership, Edition count limits, country, field structure, and catalog rules before writing. It SHALL trust the editor's assessment of meaning without an independent evidence check. Failed research, an invalid proposal, or failed validation SHALL produce no writes. Findings alone SHALL NOT be applied as a fallback.

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
A change or clear SHALL have a research finding for the same Event or Edition key and field. A source summary or unanswered question alone SHALL NOT replace that finding. The editor SHALL assess whether the finding supports the proposed value or clear. It MAY transform a finding into a valid field value. The application SHALL check the matching finding, action structure, reason, and catalog rules without comparing the meaning of the finding and action. A missing finding or invalid proposal SHALL cause rejection. A rejected proposal SHALL make no catalog or publication changes and SHALL retain its reason in the report.

#### Scenario: An update lacks a finding
- **WHEN** an update names a field without a finding for that owner, Edition key where applicable, and field
- **THEN** the whole proposal is rejected before catalog operations

#### Scenario: An update targets the wrong Event
- **WHEN** research is usable but the editor rejects an update as belonging to another Event
- **THEN** no writes occur and the report preserves the rejection reason and failed catalog outcome separately from research status

### Requirement: Omission and uncertainty preserve saved values
An omitted or unknown field SHALL leave its saved value unchanged without claiming it was verified. The editor SHALL NOT use a retrieval failure or a page's silence as grounds to clear a value. It MAY propose a clear when an explained finding disproves the saved value and catalog rules allow it. The finding alone SHALL NOT perform the clear. Supported changes MAY proceed alongside unrelated uncertainty.

#### Scenario: The source omits a saved price
- **WHEN** a failed or incomplete source read yields no supported replacement ticket block
- **THEN** the saved ticket block remains unchanged

#### Scenario: A venue is explicitly withdrawn
- **WHEN** inspected organizer evidence disproves the saved venue without naming a replacement
- **THEN** a supported update may clear it with an explanation, subject to catalog constraints

#### Scenario: Dates change while tickets remain unknown
- **WHEN** evidence supports corrected dates but ticket information is unavailable
- **THEN** the dates may change while saved tickets remain and the ticket question is reported

### Requirement: Proposed changes have an attributable basis
Every changed or cleared fact SHALL have a reason grounded in inspected evidence or saved state and retain its owner and Edition key where applicable. A newly created Event or Edition SHALL have an identity or creation explanation. Source summaries SHALL identify supporting inspected pages without requiring repeated citations for unchanged saved entries. An unsupported explanation SHALL NOT bypass validation.

#### Scenario: A venue changes
- **WHEN** research proposes a new venue for a saved Edition
- **THEN** the proposed change identifies that Edition, its new value, and why the source supports it

#### Scenario: A classification replacement retains saved terms
- **WHEN** a supported classification change retains some saved terms
- **THEN** those terms need no new source claim, while new or changed terms retain their basis

### Requirement: Field groups remain complete and owned
Dates, coordinates, tickets, and classification SHALL follow their complete-group or complete-replacement catalog rules. A change to one Edition SHALL NOT affect sibling Editions. Missing fields SHALL preserve saved values; a proposed clear SHALL be explicit and allowed by the catalog. The system SHALL reject an invalid owner, target, field type, or incomplete replacement before writing rather than silently dropping it.

#### Scenario: A date correction
- **WHEN** an Edition date range changes
- **THEN** the proposal supplies a complete start and end pair for that Edition

#### Scenario: A field is omitted
- **WHEN** a proposed update omits locality while changing venue
- **THEN** locality remains unchanged

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
When an inspected source supports an Edition ticket price, ingestion SHALL propose a complete replacement of the offers observed in that check. It SHALL NOT copy unverified saved offers. Unfinished offer checks SHALL remain visible and MAY make research partial. Without a supported price, ingestion SHALL omit tickets and preserve the saved block. Availability or sales closure alone SHALL NOT replace it.

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

### Requirement: Official link findings preserve ownership
Proposed official links SHALL be valid HTTP(S) destinations associated with the Event or the appropriate Edition. An unverified link SHALL not displace a saved link; an omitted link slot SHALL remain unchanged. A verified replacement or explicit, supported removal MAY change only the matching owner and link-kind slot, preserving other links. Evidence pages SHALL not be published as official links solely because they were inspected.

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
- **WHEN** inspected evidence disproves one Edition's ticket destination and supports its removal
- **THEN** only that Edition's ticket slot is cleared and sibling Edition links remain

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
