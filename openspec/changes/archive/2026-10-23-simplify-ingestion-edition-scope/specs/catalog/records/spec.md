# Spec Delta

## MODIFIED Requirements

### Requirement: Events and editions have separate durable identities

The catalog MUST represent an Event as a durable named identity. Each realization MUST have a separate Edition.
IDs MUST remain opaque and stable. The Event MUST own its name, aliases, summary, slug, and publication state.
The Edition MUST own its dates, status, location, estimated size, price, and classifications.
Its key MUST be unique within the Event. The key MUST NOT define its current dates.
Multiple programme periods of the same realization MUST belong to one Edition.

#### Scenario: A festival holds two separate weekends

- **WHEN** sources describe several dates or weekends as parts of one Edition
- **THEN** the catalog stores one Edition with one ID and key
- **AND** `startsOn` is the first programme date and `endsOn` is the last programme date
- **AND** the stored range includes any gaps between those dates
- **AND** separate periods do not cause separate Edition creation

#### Scenario: An edition moves dates

- **GIVEN** a published Edition
- **WHEN** its accepted dates change
- **THEN** its Event ID, Edition ID, and public key remain stable

#### Scenario: Distinct realizations share a year

- **WHEN** sources establish two distinct realizations under the same Event in one year
- **THEN** each realization retains its separate Edition identity
- **AND** a shared year alone does not combine them

#### Scenario: A gap falls inside the stored range

- **WHEN** date selection evaluates a day between programme periods of one Edition
- **THEN** it uses the complete stored range
- **AND** the range does not claim that a programme runs on every included day
