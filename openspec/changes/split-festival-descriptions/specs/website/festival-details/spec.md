## MODIFIED Requirements

### Requirement: General descriptions retain their scope

The Event page and the Edition's About the festival section SHALL show the first available text in this order: `description`, then `shortDescription`, then a neutral sentence generated from public Event data. A missing or blank value counts as absent. The automatic sentence MUST identify the festival by its public name. This text describes the festival as a whole. Generating or selecting a fallback SHALL leave both stored fields unchanged.
Historical Edition pages SHALL use the same current festival text under About the festival. The catalog SHALL NOT store a separate description version for each Edition.

#### Scenario: Only a general summary is stored

- **WHEN** a visitor opens an Edition whose Event has a description
- **THEN** the page shows that description as information about the festival
- **AND** it does not add claims about the selected year's programme

#### Scenario: Only the short text is available

- **WHEN** the detailed field is blank and the Event has a short description
- **THEN** both the Event page and the About section on an Edition show the short description

#### Scenario: Both fields are absent

- **WHEN** a public Event has neither description
- **THEN** both pages show the automatic sentence and the stored fields stay empty

#### Scenario: The festival format changed after a historical Edition

- **WHEN** a visitor opens a historical Edition page after the festival description changes
- **THEN** About the festival shows the current festival text
- **AND** the page keeps the historical Edition's own dates, status and other Edition facts

### Requirement: Event pages provide minimal information and history

The Event page SHALL show its name, the selected festival text, catalog navigation, and links to all public Editions. It SHALL NOT repeat an active Edition detail block, tickets, or a map. Edition pages SHALL link to this Event page and list Other editions, with the current Edition identified.

#### Scenario: Several Editions share a year

- **WHEN** a public Edition list contains multiple entries for one year
- **THEN** those entries include their names and dates to distinguish them
- **AND** entries are ordered by start date from newest to oldest, with stable identity order for ties
- **AND** a unique year can use a compact year label

#### Scenario: A visitor moves between Event and Edition history

- **WHEN** a visitor opens an Event page and one of its Edition pages
- **THEN** their history lists use the same ordering, labels, link presentation, and list styles
- **AND** the Edition page marks its current Edition and keeps links to the other public Editions
- **AND** history links retain any matching discovery context

#### Scenario: An Event has historical Editions only

- **WHEN** its Event page opens
- **THEN** the page links to that published history without inventing a next Edition
- **AND** cancelled and postponed public Editions remain reachable
