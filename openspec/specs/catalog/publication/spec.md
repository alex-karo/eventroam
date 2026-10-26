# Publication and public details

## Purpose

Define the structural gates and visible behavior of public festival records in the current fixture-backed application.

## Requirements

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

### Requirement: Location disclosure is qualified

An Edition with a country MAY be public without an area, coordinates, or an exact venue. Public list and detail views SHALL identify an approximate location when the venue is unknown and SHALL identify map location as unavailable when coordinates are absent. A mapped point SHALL use its Edition coordinates and precision; an absent point SHALL never be represented with `(0, 0)`.

#### Scenario: An edition has a region but no map point

- **WHEN** it appears in public results or details
- **THEN** it remains in the list with an approximate-location or map-unavailable label and does not appear as a map marker

### Requirement: Public reads expose only eligible published records

An Edition SHALL be public only when it and its Event are published under the Festivals home scope. The Event page SHALL require at least one public Edition. Public detail routes SHALL return no content for draft or withdrawn subjects. Published historical, cancelled, and postponed Editions SHALL retain detail URLs; cancelled and postponed Editions SHALL be absent from discovery summaries.

#### Scenario: A withdrawn edition is requested directly

- **WHEN** a visitor opens its former detail URL
- **THEN** no public detail payload is returned

#### Scenario: A cancelled edition is requested directly

- **WHEN** a visitor opens its retained detail URL
- **THEN** its public page remains available, while the edition is absent from discovery results

### Requirement: Publication lifecycle changes are explicit

The catalog SHALL create new subjects as drafts, publish them only through validated publication operations, and withdraw public subjects without deleting their history. Validated content updates SHALL preserve publication state. A withdrawn subject SHALL return to published only through an explicit publication operation that passes current gates; a published subject SHALL not return directly to draft.

#### Scenario: A withdrawn edition is refreshed

- **WHEN** an ordinary content update is applied to a withdrawn Edition
- **THEN** it remains withdrawn and does not become public automatically

#### Scenario: A withdrawn edition is republished

- **WHEN** an explicit publish operation passes current validation for a withdrawn Edition
- **THEN** it can become published again under the same durable identity

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

### Requirement: Model-proposed publication uses structural gates

The system SHALL validate model-proposed publication operations against the date, location, and scope gates defined in this spec. The same structural rules SHALL apply to every publication operation; complete stored facts alone SHALL NOT change publication state.

#### Scenario: Draft has structurally complete facts

- **WHEN** a publication operation targets a model-proposed draft with a year, valid programme dates, country, and the required classification facets
- **THEN** the operation passes the structural publication gates

#### Scenario: Draft lacks a required fact

- **WHEN** a publication operation targets a draft lacking a required date, country, or classification facet
- **THEN** the operation is rejected and the Edition remains a draft

### Requirement: Public uncertainty follows stored fact precision
The system SHALL distinguish provisional dates and approximate locations according to stored values while keeping source retrieval times out of public freshness indicators.

#### Scenario: Approximate locality
- **WHEN** an Edition has a locality and country but no exact venue or coordinates
- **THEN** an otherwise eligible Edition can publish with a qualified location and no map point

### Requirement: Public details present estimated festival size

Edition pages and selected previews SHALL display known size as “Estimated size: <number> people”, using English number formatting. Unknown size SHALL have no numeric label.

#### Scenario: Known and unknown size
- **WHEN** a public Edition detail is displayed
- **THEN** sizeEstimate of 8000 displays “Estimated size: 8,000 people”; null omits the size label

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
