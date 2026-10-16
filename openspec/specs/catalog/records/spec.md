# Catalog records

## Purpose

Define the fixture-backed catalog's durable Event and Edition identities, validated writes, and audit history.

## Requirements

### Requirement: Events and editions have separate durable identities

The catalog SHALL represent an Event as a durable named identity and each realization as a separate Edition. IDs SHALL be opaque and stable. The Event SHALL own its name, aliases, summary, slug, and publication state. The Edition SHALL own its edition facts, including dates, status, location, estimated size, price, and classifications. Its key SHALL be unique within the Event and SHALL not claim its current dates.

#### Scenario: A festival holds two separate weekends

- **GIVEN** a festival with two discontinuous programme periods in one year
- **WHEN** both editions are recorded
- **THEN** each has its own Edition ID and key under the same Event, and the gap is not counted as event days

#### Scenario: An edition moves dates

- **GIVEN** a published Edition
- **WHEN** its accepted dates change
- **THEN** its Event ID, Edition ID, and public key remain stable

### Requirement: Edition dates and location are validated as units

The catalog SHALL accept start and end as local calendar dates only when both are present and ordered. Absent dates SHALL have `unknown` date state; present dates SHALL have `provisional` or `confirmed` state. `scheduled` SHALL require dates. Latitude and longitude SHALL be present together with a non-`unknown` precision, or both absent with `unknown` precision. Coordinates SHALL be within latitude −90 to 90 and longitude −180 to 180. A stored size estimate SHALL be a positive integer.

#### Scenario: A partial date or coordinate is submitted

- **WHEN** a write supplies only one date or one coordinate
- **THEN** validation rejects the write without changing the record

#### Scenario: A one-day edition is recorded

- **WHEN** the programme takes place on one day
- **THEN** start and end contain the same local date and duration is one inclusive day

### Requirement: Catalog operations are versioned and replay safe

The application SHALL validate typed catalog operations. Updates SHALL require an expected version. An operation key SHALL make retries idempotent and reject a different payload. Actual changes SHALL advance the version and atomically create a `CatalogChange` with old/new values, writer, optional initiating owner, key, and apply time. No-ops SHALL add no change entry. Development fixtures may bypass this history.

#### Scenario: A stale update is attempted

- **GIVEN** an Edition version newer than the operation's expected version
- **WHEN** the operation is applied
- **THEN** it fails without overwriting the newer record or adding an audit entry

#### Scenario: An applied operation is replayed

- **WHEN** the same operation key and payload are applied again
- **THEN** the previous result is returned with no duplicate catalog or audit write

### Requirement: Official links are owned and resolved per edition

An ExternalLink SHALL belong to exactly one Event or Edition, with a kind, normalized HTTP(S) URL, and official flag. Public Edition details SHALL use official links on the Edition and inherit official Event links only for kinds not overridden by the Edition. Replacing links SHALL be a validated, versioned, audited operation.

#### Scenario: An edition overrides a ticketing link

- **GIVEN** an Event ticketing link and a different Edition ticketing link
- **WHEN** the Edition is read publicly
- **THEN** its own ticketing link is used, while other unoverridden official Event link kinds remain available

### Requirement: Typed ticket price summaries remain qualified

An Edition MAY store a bounded price summary as `free`, `exact`, `from`, or `range`, with full-programme, day, or package coverage and optional qualification. Paid amounts SHALL use nonnegative integer minor units and an uppercase three-letter currency; ranges SHALL have an upper amount above the lower. `free` SHALL mean zero for the full programme. Public details SHALL show the original currency, coverage, and qualification when stored. Price SHALL NOT affect discovery matching or order.

#### Scenario: A package price is shown

- **GIVEN** an Edition with a package price and qualification
- **WHEN** its public detail page renders
- **THEN** it identifies the amount as a package in its original currency and shows the qualification

### Requirement: Edition prices are replaced as a complete block
The catalog SHALL store ticket variants with their labels, supplied amounts/currencies, conditions, availability, and links. A zero-amount free variant MAY omit currency; positive amounts SHALL require currency and a currency SHALL require an amount. A free eligibility-restricted variant SHALL NOT imply free full-programme admission. Updating stored prices SHALL use `replacePriceBlock` with the complete variant list and primary price summary, atomically replacing both without merging individual variants. `updateEdition` SHALL reject price fields, including partial primary-summary updates. The model SHALL choose the base full-programme admission summary or leave it unknown; the host SHALL validate its structure without checking source support.

#### Scenario: A legacy partial price update is submitted
- **GIVEN** an Edition with a stored price block
- **WHEN** an `updateEdition` operation supplies `price` to change the primary summary instead of a complete `replacePriceBlock` operation
- **THEN** the operation fails without changing the record, version, or audit history

#### Scenario: Several ticket variants are collected
- **WHEN** the model supplies a full-programme pass and a day ticket for the same Edition
- **THEN** both replace the previous variant list and the base full-programme admission price replaces the primary summary

#### Scenario: Model explicitly clears prices
- **WHEN** the model explicitly supplies an empty price block for an Edition
- **THEN** the catalog replaces the variants with an empty list and clears all primary price fields, recording unknown price rather than free admission

#### Scenario: Only day tickets are priced
- **WHEN** the model supplies day-ticket prices with an unknown base full-programme price
- **THEN** the catalog stores the new variants and clears the primary summary

#### Scenario: Recheck only changes variant order
- **WHEN** the model returns the same price block with variants in a different order
- **THEN** normalization produces no catalog change

#### Scenario: A free concession has no stated currency
- **WHEN** a complete price block includes a free personal-assistant variant with amount zero and no currency
- **THEN** preserve zero without inventing a currency, and retain the independent base-price summary
- **AND** a positive amount without currency or a currency without amount is rejected

### Requirement: Ticket availability represents closed sales
Each named ticket variant MAY store availability as `unknown`, `available`, `sold_out`, or `closed`. `closed` SHALL mean sales for that category have ended or are closed, without asserting an edition-wide sell-out or cancellation. Availability SHALL be stored only inside the ticket variant list, without an edition-wide aggregate.

#### Scenario: Closed sales are recorded
- **WHEN** a validated complete price-block replacement sets a ticket variant's availability to `closed`
- **THEN** the catalog stores `closed` for that category without changing the edition's schedule status or another category's availability

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

### Requirement: Active catalog contracts name Editions
Active catalog contracts SHALL use Edition terminology, including editionId/editionKey/editionYear, create/update/publish/withdrawEdition operations, and edition link owners. Existing Edition agent/public fields, stable IDs/keys and URL paths SHALL remain unchanged. Old Occurrence operation names and fields SHALL be rejected without aliases.

#### Scenario: An Edition operation is submitted
- **WHEN** a structurally valid createEdition or updateEdition operation is submitted
- **THEN** the catalog applies the existing identity, validation, version, audit and publication rules using Edition names

#### Scenario: An old operation name is submitted
- **WHEN** an active caller submits createOccurrence, updateOccurrence, publishOccurrence, withdrawOccurrence, an occurrence owner, or occurrence-prefixed DTO fields
- **THEN** validation rejects it before catalog writes

#### Scenario: Public and agent contracts already use Edition
- **WHEN** catalog internals are renamed
- **THEN** public editions with id/key/year, agent editions with key/year, questions/errors with editionKey, and actual URLs retain their existing shapes and values

### Requirement: Edition size represents approximate participant scale

An Edition SHALL expose optional `sizeEstimate`: a positive integer estimate of festival size in people, or null when unknown. It SHALL replace `capacityEstimate` in active catalog, research, and public contracts without aliases. Size SHALL describe participant scale rather than maximum occupancy or exact attendance, and SHALL remain optional for publication.

#### Scenario: Size validation
- **WHEN** an Edition write supplies a size
- **THEN** positive integers and null are accepted; zero, negatives, fractions, and the obsolete capacityEstimate field are rejected
