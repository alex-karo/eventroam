# Spec Delta

## ADDED Requirements

### Requirement: Publication requires edition-relevant source support
The system SHALL publish an Occurrence only when its public dates and location are supported by applicable source evidence in addition to structural validation.

#### Scenario: Imported dates are not current verification
- **WHEN** a legacy import contains dates and a location but no current supporting source check
- **THEN** the Occurrence remains a draft

### Requirement: Public uncertainty follows accepted evidence
The system SHALL distinguish supported provisional dates and approximate locations from invented precision while keeping evidence retrieval times out of public freshness indicators.

#### Scenario: Supported approximate locality
- **WHEN** a source supports a locality and country but no exact venue or coordinates
- **THEN** an otherwise eligible Occurrence can publish with a qualified location and no map point
