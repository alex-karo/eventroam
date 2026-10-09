# Catalog records

## Purpose

Define the fixture-backed catalog's durable Event and Occurrence identities, validated writes, and audit history.

## Requirements

### Requirement: Events and editions have separate durable identities

The catalog SHALL represent an Event as a durable named identity and each realization as a separate Occurrence. IDs SHALL be opaque and stable. The Event SHALL own its name, aliases, summary, slug, and publication state. The Occurrence SHALL own its edition facts, including dates, status, location, capacity, price, and classifications. Its key SHALL be unique within the Event and SHALL not claim its current dates.

#### Scenario: A festival holds two separate weekends

- **GIVEN** a festival with two discontinuous programme periods in one year
- **WHEN** both editions are recorded
- **THEN** each has its own Occurrence ID and key under the same Event, and the gap is not counted as event days

#### Scenario: An edition moves dates

- **GIVEN** a published Occurrence
- **WHEN** its accepted dates change
- **THEN** its Event ID, Occurrence ID, and public key remain stable

### Requirement: Occurrence dates and location are validated as units

The catalog SHALL accept start and end as local calendar dates only when both are present and ordered. Absent dates SHALL have `unknown` date state; present dates SHALL have `provisional` or `confirmed` state. `scheduled` SHALL require dates. Latitude and longitude SHALL be present together with a non-`unknown` precision, or both absent with `unknown` precision. Coordinates SHALL be within latitude −90 to 90 and longitude −180 to 180. A stored capacity estimate SHALL be a positive integer.

#### Scenario: A partial date or coordinate is submitted

- **WHEN** a write supplies only one date or one coordinate
- **THEN** validation rejects the write without changing the record

#### Scenario: A one-day edition is recorded

- **WHEN** the programme takes place on one day
- **THEN** start and end contain the same local date and duration is one inclusive day

### Requirement: Catalog operations are versioned and replay safe

The application SHALL validate typed catalog operations. Updates SHALL require an expected version. An operation key SHALL make retries idempotent and reject a different payload. Actual changes SHALL advance the version and atomically create a `CatalogChange` with old/new values, writer, optional initiating owner, key, and apply time. No-ops SHALL add no change entry. Development fixtures may bypass this history.

#### Scenario: A stale update is attempted

- **GIVEN** an Occurrence version newer than the operation's expected version
- **WHEN** the operation is applied
- **THEN** it fails without overwriting the newer record or adding an audit entry

#### Scenario: An applied operation is replayed

- **WHEN** the same operation key and payload are applied again
- **THEN** the previous result is returned with no duplicate catalog or audit write

### Requirement: Official links are owned and resolved per edition

An ExternalLink SHALL belong to exactly one Event or Occurrence, with a kind, normalized HTTP(S) URL, and official flag. Public Occurrence details SHALL use official links on the Occurrence and inherit official Event links only for kinds not overridden by the Occurrence. Replacing links SHALL be a validated, versioned, audited operation.

#### Scenario: An edition overrides a ticketing link

- **GIVEN** an Event ticketing link and a different Occurrence ticketing link
- **WHEN** the Occurrence is read publicly
- **THEN** its own ticketing link is used, while other unoverridden official Event link kinds remain available

### Requirement: Typed ticket price summaries remain qualified

An Occurrence MAY store a bounded price summary as `free`, `exact`, `from`, or `range`, with full-programme, day, or package coverage and optional qualification. Paid amounts SHALL use nonnegative integer minor units and an uppercase three-letter currency; ranges SHALL have an upper amount above the lower. `free` SHALL mean zero for the full programme. Public details SHALL show the original currency, coverage, and qualification when stored. Price SHALL NOT affect discovery matching or order.

#### Scenario: A package price is shown

- **GIVEN** an Occurrence with a package price and qualification
- **WHEN** its public detail page renders
- **THEN** it identifies the amount as a package in its original currency and shows the qualification

### Requirement: Occurrence prices are replaced as a complete block
The catalog SHALL store ticket variants with their labels, supplied amounts/currencies, conditions, availability, and links. A price update SHALL atomically replace the complete variant list and primary price summary without merging individual variants. The model SHALL choose the base full-programme admission summary or leave it unknown; the host SHALL validate its structure without checking source support.

#### Scenario: Several ticket variants are collected
- **WHEN** the model supplies a full-programme pass and a day ticket for the same Occurrence
- **THEN** both replace the previous variant list and the base full-programme admission price replaces the primary summary

#### Scenario: Model explicitly clears prices
- **WHEN** the model explicitly supplies an empty price block for an Occurrence
- **THEN** the catalog replaces the variants with an empty list and clears all primary price fields, recording unknown price rather than free admission

#### Scenario: Only day tickets are priced
- **WHEN** the model supplies day-ticket prices with an unknown base full-programme price
- **THEN** the catalog stores the new variants and clears the primary summary

#### Scenario: Recheck only changes variant order
- **WHEN** the model returns the same price block with variants in a different order
- **THEN** normalization produces no catalog change

### Requirement: Ticket availability represents closed sales
Occurrence ticket availability SHALL support `unknown`, `available`, `sold_out`, and `closed`. `closed` SHALL mean general-admission sales have ended or are closed, without asserting an edition-wide sell-out or cancellation. Existing values SHALL retain their meaning.

#### Scenario: Closed sales are recorded
- **WHEN** a validated operation sets an Occurrence's ticket availability to `closed`
- **THEN** the catalog stores and returns `closed` without changing the edition's schedule status

### Requirement: Model writes retain changes and attribution
The system SHALL commit catalog changes, operation receipts, actor, and any supplied initiating owner atomically. The audit SHALL retain old and new field values.

#### Scenario: Model changes dates and venue
- **WHEN** the model proposes structurally valid date and venue changes
- **THEN** the audit records those old and new values with actor attribution

### Requirement: Audit history remains private
Applied field changes SHALL remain immutable and SHALL not appear in public summaries, pages, or discovery responses. Failed and unchanged checks SHALL not create CatalogChange entries solely to record a check.

#### Scenario: Source wording changes without a catalog fact change
- **WHEN** the model returns the same stored facts after reading changed page wording
- **THEN** no new catalog change is recorded
