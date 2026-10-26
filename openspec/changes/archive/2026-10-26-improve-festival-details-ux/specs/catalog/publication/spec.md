# Spec Delta

## MODIFIED Requirements

### Requirement: Public pages preserve edition status and uncertainty

The Event page SHALL show its name, optional summary, and public Edition history without a separate active Edition detail block. The Edition page SHALL show known dates, status, location, useful classifications, estimated size, price, and official links. Provisional dates SHALL say Tentative dates. Postponed pages SHALL say Postponed — new dates TBA and Previous dates. Cancelled pages SHALL remain available. Ticket availability SHALL appear only beside its category.

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

### Requirement: Public details distinguish closed ticket sales

Public Edition details SHALL show availability beside its category: available as Available, sold_out as Sold out, and closed as Ticket sales closed. Unknown availability SHALL have no badge. Past Editions SHALL suppress Available labels. Public category payloads SHALL expose label, optional amount, currency, terms, and availability. They SHALL omit category URLs, research reasons, source summaries, and audit data. Schedule status SHALL remain independent.

#### Scenario: Ticket sales have closed

- **WHEN** a published edition has a ticket category with availability closed
- **THEN** only that category shows Ticket sales closed
- **AND** it does not imply Edition-wide closure, cancellation, or sell-out

#### Scenario: Categories have different availability

- **WHEN** Early Bird is sold out and Regular is available for an upcoming Edition
- **THEN** details show each category's own state and no Edition-wide availability

#### Scenario: Availability remains unknown

- **WHEN** a category has no known availability or no variants are stored
- **THEN** no availability is inferred from base price, dates, or schedule status
- **AND** no global badge is shown

#### Scenario: Public category information stays limited

- **WHEN** an eligible public Edition is read
- **THEN** its categories expose only the approved public fields
- **AND** no category URL, research reason, source summary, or audit entry is exposed
- **AND** the existing base price and publication gates are unchanged

#### Scenario: An Edition has ended

- **WHEN** its end date precedes today in its time zone, with UTC fallback
- **THEN** its page shows Past edition and qualifies known prices with Prices for this edition
- **AND** stored Available labels are hidden while Sold out and Ticket sales closed can remain
- **AND** the tooltip and accessible name of any ticket link include the Edition year
- **AND** cancellation and postponement notices retain their meaning and prominence

## ADDED Requirements

### Requirement: Category prices preserve stored meaning

Edition ticket sections SHALL show each category's stored amount, currency, terms, and known availability. Zero SHALL display Free. Missing price SHALL display Price not available. Base price SHALL remain separate and SHALL NOT be copied into categories or recalculated from availability. Category-specific purchase buttons SHALL NOT be shown.

#### Scenario: A category has a price and terms

- **WHEN** a category has amount 69.9, currency EUR, and a fee condition
- **THEN** its row shows the formatted EUR price and the stored condition
- **AND** the amount is treated as major currency units
- **AND** no range, From prefix, coverage, or fee claim is invented

#### Scenario: A category has no price

- **WHEN** its amount is absent
- **THEN** its row shows Price not available and retains known terms and status
- **AND** a zero amount without currency instead displays Free

#### Scenario: Ticket data is absent or partial

- **WHEN** no base price and no categories are known
- **THEN** the Edition page shows Ticket information not available once
- **AND** when only a base price is known, it is shown without an empty category list

#### Scenario: A promotional category sells out

- **WHEN** a category becomes sold out
- **THEN** the stored base price remains qualified by its own known conditions
- **AND** it is not described as the lowest currently available offer

### Requirement: Public details expose map facts without private evidence

Public Edition reads SHALL expose nullable latitude and longitude, stored coordinate precision, and optional time zone. Public locations SHALL use these values without inventing a point. Event summaries SHALL remain available for general festival descriptions. Private evidence and source retrieval times SHALL remain outside public payloads.

#### Scenario: A region point is stored

- **WHEN** a public Edition has coordinates with region precision
- **THEN** detail reads expose that point with its region precision
- **AND** the UI does not treat it as an exact venue

#### Scenario: A point is absent

- **WHEN** an Edition has no coordinates
- **THEN** public coordinates remain null
- **AND** no fallback point at zero latitude and longitude is added
