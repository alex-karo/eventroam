## MODIFIED Requirements

### Requirement: Publication enforces edition facts and festival scope

An Occurrence SHALL publish only with a year, date pair, country, and venue, locality, or region. Festival scope SHALL also require the Occurrence's `openair` or `mixed-indoor-outdoor` format; `festival` or `gathering` type; and `music` topic or `burning-like` culture. An Event SHALL publish only after a published Occurrence and SHALL then receive the Festivals home scope. Draft and withdrawn subjects SHALL stay outside public reads.

#### Scenario: An edition has only a country

- **WHEN** publication is attempted without a venue, locality, or region
- **THEN** publication is rejected and the Occurrence remains nonpublic

#### Scenario: A non-musical participatory burn is published

- **GIVEN** a dated, located outdoor gathering with `burning-like` culture and no music genre
- **WHEN** the Occurrence and Event pass publication
- **THEN** the edition is publicly available in the Festivals scope

#### Scenario: Additional topics cannot replace physical format

- **GIVEN** a dated, located festival with music and additional topic assignments but no openair or mixed-indoor-outdoor format
- **WHEN** publication is attempted
- **THEN** publication is rejected
