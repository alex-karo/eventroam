# Publication and public details

## Purpose

Define the structural gates and visible behavior of public festival records in the current fixture-backed application.

## Requirements

### Requirement: Publication enforces edition facts and festival scope

An Occurrence SHALL publish only with a year, date pair, country, and venue, locality, or region. Festival scope SHALL also require the Occurrence's `outdoor` or `mixed-indoor-outdoor` format; `festival` or `gathering` type; and `music` topic or `burning-like` culture. An Event SHALL publish only after a published Occurrence and SHALL then receive the Festivals home scope. Draft and withdrawn subjects SHALL stay outside public reads.

#### Scenario: An edition has only a country

- **WHEN** publication is attempted without a venue, locality, or region
- **THEN** publication is rejected and the Occurrence remains nonpublic

#### Scenario: A non-musical participatory burn is published

- **GIVEN** a dated, located outdoor gathering with `burning-like` culture and no music genre
- **WHEN** the Occurrence and Event pass publication
- **THEN** the edition is publicly available in the Festivals scope

### Requirement: Public pages preserve edition status and uncertainty

The Event page SHALL show its name, summary, selected active edition, and published history; if none is active, it SHALL say so. The Occurrence page SHALL show known dates, status, location, classifications, capacity, price, and official links. Provisional dates SHALL say “Tentative dates.” A published postponed edition SHALL retain its page with “Postponed — new dates TBA” and “Previous dates.” Cancelled editions SHALL retain their pages. Ticket availability SHALL appear only beside a named ticket category, never as an edition-wide label.

#### Scenario: A postponed published edition has no replacement dates

- **WHEN** its public page is opened
- **THEN** the page displays the postponement notice and labels the retained date pair as previous dates

#### Scenario: A published Event has only historical editions

- **WHEN** its Event page is opened
- **THEN** it links to published history and does not identify a historical, cancelled, or postponed edition as next

#### Scenario: A visitor navigates without the map

- **WHEN** a visitor follows an ordinary result link to an Occurrence and then to its Event page
- **THEN** both pages remain usable without loading the interactive map, and the Event links its other published editions

### Requirement: Location disclosure is qualified

An Occurrence with a country and supported area MAY be public without coordinates or an exact venue. Public list and detail views SHALL identify an approximate location when the venue is unknown and SHALL identify map location as unavailable when coordinates are absent. A mapped point SHALL use its Occurrence coordinates and precision; an absent point SHALL never be represented with `(0, 0)`.

#### Scenario: An edition has a region but no map point

- **WHEN** it appears in public results or details
- **THEN** it remains in the list with an approximate-location or map-unavailable label and does not appear as a map marker

### Requirement: Public reads expose only eligible published records

An Occurrence SHALL be public only when it and its Event are published under the Festivals home scope. The Event page SHALL require at least one public Occurrence. Public detail routes SHALL return no content for draft or withdrawn subjects. Published historical, cancelled, and postponed Occurrences SHALL retain detail URLs; cancelled and postponed Occurrences SHALL be absent from discovery summaries.

#### Scenario: A withdrawn edition is requested directly

- **WHEN** a visitor opens its former detail URL
- **THEN** no public detail payload is returned

#### Scenario: A cancelled edition is requested directly

- **WHEN** a visitor opens its retained detail URL
- **THEN** its public page remains available, while the edition is absent from discovery results

### Requirement: Publication lifecycle changes are explicit

The catalog SHALL create new subjects as drafts, publish them only through validated publication operations, and withdraw public subjects without deleting their history. Validated content updates SHALL preserve publication state. A withdrawn subject SHALL return to published only through an explicit publication operation that passes current gates; a published subject SHALL not return directly to draft.

#### Scenario: A withdrawn edition is refreshed

- **WHEN** an ordinary content update is applied to a withdrawn Occurrence
- **THEN** it remains withdrawn and does not become public automatically

#### Scenario: A withdrawn edition is republished

- **WHEN** an explicit publish operation passes current validation for a withdrawn Occurrence
- **THEN** it can become published again under the same durable identity

### Requirement: Public details distinguish closed ticket sales
Public edition details SHALL display known ticket availability beside its category: available as “Available”, sold_out as “Sold out”, and closed as “Ticket sales closed”. Missing/unknown availability SHALL have no status badge. Public payloads SHALL omit edition-wide ticketAvailability; schedule status SHALL remain independent.

#### Scenario: Ticket sales have closed
- **WHEN** a published edition has a ticket category with availability closed
- **THEN** only that category shows “Ticket sales closed”, without implying edition-wide closure, cancellation, or sell-out


#### Scenario: Categories disagree with the legacy aggregate
- **WHEN** Early Bird is sold out, Regular is available, and the old occurrence field says sold_out or closed
- **THEN** details show each category's own state, ignore the old aggregate, and expose no edition-wide availability

#### Scenario: Availability remains unknown
- **WHEN** a category has no known availability or no variants are stored
- **THEN** no availability is inferred from base price, dates, or schedule status, and no global badge is shown

#### Scenario: Public category information stays limited
- **WHEN** an eligible public edition is read
- **THEN** expose category labels/availability without research reasons, source summaries, audit entries, or other private variant data
- **AND** existing primary price display and publication gates remain unchanged

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
