# Public ticket availability delta

## MODIFIED Requirements

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
