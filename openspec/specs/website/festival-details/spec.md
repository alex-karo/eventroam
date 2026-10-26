# Festival details

## Purpose

Help visitors assess one festival Edition through clear facts, ticket prices, and location. Keep the Event page as a compact entry to its published history.

## Requirements

### Requirement: Edition pages put key facts first

The Edition page SHALL show its title, dates, inclusive duration, place, useful classification terms, known estimated size, base price, and external links near the top. The remaining sections SHALL be description, tickets, location, and other Editions, in that order. Empty optional sections SHALL be omitted.

#### Scenario: A visitor opens an Edition

- **WHEN** a public Edition page opens
- **THEN** its key facts precede the detail sections
- **AND** classifications appear as readable groups or tags rather than a generic Classification section
- **AND** dates use the same readable English format as discovery cards and results, with the year included
- **AND** same-month ranges omit repeated month and year text, while cross-year ranges retain both years
- **AND** Tentative dates follows the date range when dates are provisional
- **AND** duration stays together and the base price is more prominent than its complete stored qualification
- **AND** genres precede quieter general types without dropping terms
- **AND** countries use English names instead of ISO codes

#### Scenario: Optional facts are absent

- **WHEN** description, size, or street address is unknown
- **THEN** no empty row or section is shown for that fact
- **AND** missing ticket and map information follows its explicit fallback rules

### Requirement: General descriptions retain their scope

The Edition page SHALL show the known Event summary under About the festival. It SHALL NOT present that text as the Edition's confirmed programme. The description section SHALL be omitted if no summary is known.

#### Scenario: Only a general summary is stored

- **WHEN** a visitor opens an Edition whose Event has a summary
- **THEN** the page shows that summary as information about the festival
- **AND** it does not add claims about the selected year's programme

### Requirement: External links use accessible icon buttons

External links in festival cards and detail content SHALL use compact buttons with visible labels and icons. Each SHALL have a title, an aria-label, and a minimum height of 32 CSS pixels. Known link types SHALL use distinct icons from one outline set. Unknown types SHALL use a generic link icon.

#### Scenario: Links share a type

- **WHEN** several links of one type have different URLs
- **THEN** each remains available with a distinct name based on its label or hostname
- **AND** the main official site uses a globe, additional official-site links use an information icon, and ticket links use a ticket icon
- **AND** identical URLs appear only once within that link group
- **AND** the controls wrap without horizontal page overflow

#### Scenario: A visitor uses a keyboard

- **WHEN** an external link button receives focus
- **THEN** its purpose is available to assistive technology in its visible label, with a clear focus indicator
- **AND** internal history and breadcrumb links retain visible text

### Requirement: Key fact icons support compact reading

Festival cards and Edition pages SHALL use consistent outline icons for dates, place, tickets, and known estimated size. Icons beside visible fact text SHALL be decorative. The UI SHALL retain the current font and colors, use smaller headings and gaps, and remain usable at 320 CSS pixels.

#### Scenario: The page width changes

- **WHEN** an Edition page is viewed on a narrow or wide screen
- **THEN** all page sections use one column in the same reading order
- **AND** text remains readable and controls remain reachable

### Requirement: Edition locations have a qualified map

An Edition with coordinates SHALL show one location point in its location section, with attribution and zoom buttons. Initial zoom SHALL reflect stored precision. Wheel scrolling over the map SHALL NOT zoom it. Missing coordinates SHALL leave the place text and Not mapped with the title Map location unavailable, without an empty map.

#### Scenario: A point is approximate

- **WHEN** precision is approximate, locality, region, or unknown
- **THEN** the map uses a broader view than an exact point and shows Approximate location
- **AND** the UI does not describe the point as the venue entrance

#### Scenario: The map cannot load

- **WHEN** map configuration, rendering support, or loading fails
- **THEN** a visible map fallback appears
- **AND** the place text, ticket content, history links, and external location link remain usable

### Requirement: Location actions use the Edition point

For an Edition with coordinates, Show on map SHALL move to the page's location section. A labeled external map link SHALL open the saved point. Its name SHALL be Open approximate location for non-exact precision. Both actions SHALL be absent without coordinates.

#### Scenario: A visitor follows a location action

- **WHEN** Show on map is activated
- **THEN** the page moves to its own location section
- **AND** the external map action opens a place view rather than a route to a claimed entrance

### Requirement: Event pages provide minimal information and history

The Event page SHALL show its name, optional summary, catalog navigation, and links to all public Editions. It SHALL NOT repeat an active Edition detail block, tickets, or a map. Edition pages SHALL link to this Event page and list Other editions, with the current Edition identified.

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
