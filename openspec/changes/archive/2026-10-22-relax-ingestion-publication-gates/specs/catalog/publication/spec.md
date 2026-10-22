# Spec Delta

## MODIFIED Requirements

### Requirement: Publication enforces edition facts and festival scope

An Edition SHALL publish only with a year, date pair, and country. Venue, locality, and region SHALL be optional. Classification SHALL require one `format`, one `event_type`, and at least one `topic` or `culture` term, without requiring specific values. Existing term validity and assignment rules SHALL apply. An Event SHALL publish only after a published Edition of any year and SHALL then receive the Festivals home scope. Draft and withdrawn subjects SHALL stay outside public reads.

#### Scenario: An edition has only a country

- **GIVEN** an Edition with a year, date pair, country, and required classification facets
- **WHEN** publication is attempted without a venue, locality, or region
- **THEN** it passes the publication gates

#### Scenario: A non-musical participatory burn is published

- **GIVEN** a dated, located outdoor gathering with `burning-like` culture and no music genre
- **WHEN** the Edition and Event pass publication
- **THEN** the edition is publicly available in the Festivals scope

#### Scenario: Classification values differ from the previous allowed values

- **GIVEN** an otherwise eligible Edition with valid `format`, `event_type`, and `topic` or `culture` assignments
- **WHEN** their values are outside the previous open-air, festival/gathering, and music/burning-like restrictions
- **THEN** those values do not prevent publication

#### Scenario: Additional topics cannot replace physical format

- **GIVEN** a dated, located festival with music and additional topic assignments but no format assignment
- **WHEN** publication is attempted
- **THEN** publication is rejected

#### Scenario: Event type or theme is absent

- **WHEN** publication is attempted without an event type or without both topic and culture
- **THEN** publication is rejected

#### Scenario: A required date or country is absent

- **WHEN** publication is attempted without a year, complete date pair, or country
- **THEN** publication is rejected

#### Scenario: Only a historical edition is publishable

- **GIVEN** a historical Edition that passes the publication gates and no announced next-year Edition
- **WHEN** ingestion publishes that Edition and its Event
- **THEN** the Event can publish without a future Edition
- **AND** a new undated Edition remains a draft

### Requirement: Location disclosure is qualified

An Edition with a country MAY be public without an area, coordinates, or an exact venue. Public list and detail views SHALL identify an approximate location when the venue is unknown and SHALL identify map location as unavailable when coordinates are absent. A mapped point SHALL use its Edition coordinates and precision; an absent point SHALL never be represented with `(0, 0)`.

#### Scenario: An edition has a region but no map point

- **WHEN** it appears in public results or details
- **THEN** it remains in the list with an approximate-location or map-unavailable label and does not appear as a map marker

### Requirement: Model-proposed publication uses structural gates

The system SHALL validate model-proposed publication operations against the date, location, and scope gates defined in this spec. The same structural rules SHALL apply to every publication operation; complete stored facts alone SHALL NOT change publication state.

#### Scenario: Draft has structurally complete facts

- **WHEN** a publication operation targets a model-proposed draft with a year, valid programme dates, country, and the required classification facets
- **THEN** the operation passes the structural publication gates

#### Scenario: Draft lacks a required fact

- **WHEN** a publication operation targets a draft lacking a required date, country, or classification facet
- **THEN** the operation is rejected and the Edition remains a draft
