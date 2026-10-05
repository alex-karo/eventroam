# Spec Delta

## MODIFIED Requirements

### Requirement: Public details distinguish closed ticket sales
Public edition details SHALL display `closed` ticket availability as “Ticket sales closed”, separately from sold-out and cancelled states.

#### Scenario: Ticket sales have closed
- **WHEN** a published Occurrence has ticket availability `closed`
- **THEN** its details show “Ticket sales closed” without implying cancellation or a sell-out

### Requirement: Model-proposed publication uses structural gates
The system SHALL publish an Occurrence when its stored values satisfy the existing date, location, and scope rules. The same structural rules SHALL apply to every publication operation.

#### Scenario: Draft has structurally complete facts
- **WHEN** a model-proposed draft has valid programme dates, country, a qualified location, and in-scope taxonomy terms
- **THEN** it may publish

#### Scenario: Draft lacks a required fact
- **WHEN** a draft lacks a required date, location, or scope term
- **THEN** it remains a draft

### Requirement: Public uncertainty follows stored fact precision
The system SHALL distinguish provisional dates and approximate locations according to stored values while keeping source retrieval times out of public freshness indicators.

#### Scenario: Approximate locality
- **WHEN** an Occurrence has a locality and country but no exact venue or coordinates
- **THEN** an otherwise eligible Occurrence can publish with a qualified location and no map point
