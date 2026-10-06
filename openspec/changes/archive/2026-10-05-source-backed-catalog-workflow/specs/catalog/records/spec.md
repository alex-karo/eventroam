# Spec Delta

## MODIFIED Requirements

### Requirement: Occurrence prices are replaced as a complete block
The catalog SHALL store ticket variants with their labels, supplied amounts/currencies, conditions, availability, and links. A price update SHALL atomically replace the complete variant list and primary price summary without merging individual variants. The model SHALL choose the base full-programme admission summary or leave it unknown; the host SHALL validate its structure without checking source support. Variant display on the website is outside this change.

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
