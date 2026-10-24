# Spec Delta

## MODIFIED Requirements

### Requirement: Publication enforces edition facts and festival scope

An Edition SHALL publish only with a year, date pair, and country. Venue, locality, and region SHALL be optional. Classification SHALL require one `event_type` and at least one `topic` or `culture` term, without requiring specific values. A `format` assignment SHALL be optional. Existing term validity and assignment rules SHALL apply. An Event SHALL publish only after a published Edition of any year and SHALL then receive the Festivals home scope. Draft and withdrawn subjects SHALL stay outside public reads.

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

#### Scenario: Unknown physical format permits publication

- **GIVEN** a dated, located festival with music and additional topic assignments but no format assignment
- **WHEN** publication is attempted
- **THEN** publication passes the gates without adding a format assignment

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
