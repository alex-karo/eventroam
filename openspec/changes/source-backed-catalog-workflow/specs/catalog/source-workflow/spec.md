# Spec Delta

## Purpose

Supports owner-initiated catalog collection and refresh while preserving durable identities, accepted facts, and attributable run outcomes.

## ADDED Requirements

### Requirement: Collection runs are owner initiated
The system SHALL start discovery, source checks, imports, and refreshes only through an owner-initiated operation in the first release.

#### Scenario: No unattended refresh
- **WHEN** no owner starts a run
- **THEN** the catalog does not autonomously discover or refresh records

### Requirement: Legacy imports create stable drafts
When importing records from the legacy eventmap dump, the system SHALL create incomplete records as drafts and retain a stable mapping from legacy identities to catalog identities.

#### Scenario: Import replay
- **WHEN** the same legacy record is imported again
- **THEN** the run reuses its mapped Event and Occurrence and does not overwrite a newer verified value or owner correction

### Requirement: Candidate matching respects enduring Event identity
The system SHALL use linked source identity, stable official IDs, canonical URLs, and compatible name, geography, and edition facts to match candidates. It SHALL keep parallel festivals under one brand as separate Events while preserving one Event when a festival relocates between years. Ambiguous matches SHALL be skipped rather than guessed or auto-merged by name alone.

#### Scenario: Same brand in different countries
- **WHEN** two recurring festivals share a brand but operate in different countries at the same time
- **THEN** candidate matching preserves separate Event identities

#### Scenario: A festival relocates
- **WHEN** official continuity establishes that a recurring festival moved to a new location
- **THEN** a new edition is linked to the existing Event instead of creating a second Event

### Requirement: Refreshes preserve accepted facts on uncertainty
The system SHALL leave affected accepted values unchanged when a fetch fails, a field is missing, sources conflict, or candidate identity is ambiguous.

#### Scenario: Conflicting source claim
- **WHEN** two inspected sources disagree about a material edition fact and the conflict is unresolved
- **THEN** the run skips that field change and reports the reason without creating an approval task

### Requirement: Runs report attributable outcomes
The system SHALL report checked, created, updated, published, unchanged, skipped, and failed outcomes with stable subject and source identifiers.

#### Scenario: Unchanged recheck
- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

### Requirement: Dry runs preview changes without applying them
The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run without mutating records or audit history.

#### Scenario: Dry run of a venue correction
- **WHEN** the owner requests a dry run for a supported venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged

### Requirement: Eligible apply runs publish without review queues
The system SHALL apply and publish source-supported eligible records directly through validated operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival
- **WHEN** an owner-initiated run verifies a new in-scope Event and Occurrence with all publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

### Requirement: Owners can retrieve private field-change history
The system SHALL let the owner retrieve applied field-change history, including old and new values, UTC apply time, writer, initiating owner, and supporting evidence, without exposing that history publicly.

#### Scenario: Retrieve a corrected date
- **WHEN** the owner asks for an Occurrence's change history after a date correction
- **THEN** the response identifies the previous and accepted dates and their attributable applied change

### Requirement: Source checks distinguish unknown from negative facts
The system SHALL preserve unknown optional details and source wording without treating a missing extraction as a negative or zero value.

#### Scenario: Missing practical detail
- **WHEN** an official page says nothing about camping or a price
- **THEN** the run leaves those facts unknown rather than recording no camping or free admission

### Requirement: Capacity claims retain their source meaning
The system SHALL set `capacityEstimate` only from a supported edition-specific maximum or planned capacity. It SHALL preserve ranges and other attendance measures as source evidence without inventing a midpoint or converting visits, venue occupancy, campsite capacity, or remaining tickets into capacity.

#### Scenario: A source gives an attendance range
- **WHEN** an inspected source says an edition drew between 8,000 and 10,000 visits
- **THEN** the run retains that wording as evidence and does not set `capacityEstimate` to 9,000

### Requirement: Ticket availability uses edition-wide authorized claims
The system SHALL set `sold_out` only from an explicit whole-edition statement by the organizer or authorized seller. It SHALL distinguish partial sell-outs, closed sales, unknown availability, and a later supported reopening.

#### Scenario: One ticket tier sells out
- **WHEN** only a ticket tier, day, campsite, or allocation is marked sold out
- **THEN** the run does not mark the whole Occurrence `sold_out`

#### Scenario: Official sales reopen
- **WHEN** an authorized source confirms general-admission sales reopened after an edition-wide sell-out
- **THEN** a source-backed update may return the edition to `available` without changing its identity

### Requirement: Collected prices preserve original terms
The system SHALL retain an offer's original amount and currency, coverage, tier or eligibility, sales window, fees, mandatory extras, availability, qualification, and official link when known. It SHALL not guess currency from an ambiguous symbol, fabricate per-person package totals, treat missing price as free, or present expired offers as available.

#### Scenario: Explicit full-programme free admission
- **WHEN** an official edition source explicitly confirms free admission for the complete programme
- **THEN** the run may record `free` while retaining optional donations and other material conditions; a mandatory charge or deposit remains a qualified term and does not by itself establish free admission

#### Scenario: Currency is ambiguous
- **WHEN** a price uses an ambiguous symbol without an established currency
- **THEN** the run preserves source wording and does not assign a currency code or converted amount

### Requirement: Optional practical details stay qualified
The system SHALL attempt edition-specific camping, admission-age, accessibility, travel, and participation details from applicable sources without making their absence a publication gate or a public filter.

#### Scenario: Camping near the event
- **WHEN** a source describes nearby accommodation but does not confirm on-site camping
- **THEN** the run keeps on-site camping unknown and retains the nearby option as qualified detail

### Requirement: Edition programme dates exclude adjacent windows
The system SHALL verify dates for the public event programme and SHALL not substitute camping, gate, build, strike, accommodation, or ticket-sale windows for the Occurrence date pair.

#### Scenario: Campsite opens early
- **WHEN** camping opens two days before the advertised programme
- **THEN** the Occurrence start date remains the first supported programme day

### Requirement: A fallow year is not a cancelled edition
The system SHALL treat a confirmed no-edition year as evidence of absence rather than creating a placeholder or cancelled Occurrence.

#### Scenario: Organizer announces no edition this year
- **WHEN** the organizer confirms that no edition will take place in a calendar year
- **THEN** the run records the source observation without creating a cancelled Occurrence for that year
