# Spec Delta

## MODIFIED Requirements

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
