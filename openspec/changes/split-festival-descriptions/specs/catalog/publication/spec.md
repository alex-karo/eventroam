## MODIFIED Requirements

### Requirement: Public pages preserve edition status and uncertainty

The Event page SHALL show its name, the festival text selected by the detail page, and public Edition history without a separate active Edition detail block. The Edition page SHALL show known dates, status, location, useful classifications, estimated size, price, and official links. Provisional dates SHALL say Tentative dates. Postponed pages SHALL say Postponed — new dates TBA and Previous dates. Cancelled pages SHALL remain available. Ticket availability SHALL appear only beside its category.

#### Scenario: A postponed published edition has no replacement dates

- **WHEN** its public page is opened
- **THEN** the page displays the postponement notice and labels the retained date pair as previous dates

#### Scenario: A published Event has only historical editions

- **WHEN** its Event page is opened
- **THEN** it links to published history and does not identify a historical, cancelled, or postponed edition as next

#### Scenario: A visitor navigates without the map

- **WHEN** a visitor follows an ordinary result link to an Edition and then to its Event page
- **THEN** both pages remain usable without loading the interactive map
- **AND** the Event links its other published editions

### Requirement: Public details expose map facts without private evidence

Public Edition reads SHALL expose nullable latitude and longitude, stored coordinate precision, and optional time zone. Public locations SHALL use these values without inventing a point. Public Event reads SHALL expose the optional `description` and `shortDescription`. Private evidence and source retrieval times SHALL remain outside public payloads.

#### Scenario: A region point is stored

- **WHEN** a public Edition has coordinates with region precision
- **THEN** detail reads expose that point with its region precision
- **AND** the UI does not treat it as an exact venue

#### Scenario: A point is absent

- **WHEN** an Edition has no coordinates
- **THEN** public coordinates remain null
- **AND** no fallback point at zero latitude and longitude is added
