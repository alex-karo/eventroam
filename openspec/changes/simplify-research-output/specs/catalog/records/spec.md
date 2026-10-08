# Catalog records delta

## MODIFIED Requirements

### Requirement: Occurrence prices are replaced as a complete block
The catalog SHALL store ticket variants with their labels, supplied amounts/currencies, conditions, availability, and links. A price update SHALL atomically replace the complete variant list and primary price summary without merging individual variants. The model SHALL choose the base full-programme admission summary or leave it unknown; the host SHALL validate its structure without checking source support. Public details SHALL expose variant labels and availability; other variant data remains private in this change.

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
