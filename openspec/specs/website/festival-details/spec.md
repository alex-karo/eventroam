# Festival details

## Purpose

Help visitors assess one festival Edition through clear facts, ticket prices, and location. Keep the Event page as a compact entry to its published history.

## Requirements

### Requirement: Edition pages put key facts first

The Edition page SHALL show its title, dates, inclusive duration, place, useful classification terms, known estimated size, base price, and ticket and official-site links near the top. Other external links SHALL remain available below the detail sections. The detail sections SHALL be description, ticket categories when known, location, and other Editions, in that order. Empty optional sections SHALL be omitted.

#### Scenario: A visitor opens an Edition

- **WHEN** a public Edition page opens
- **THEN** its key facts precede the detail sections
- **AND** known classifications appear as readable tags below the title
- **AND** dates use the same readable English format as discovery cards and results, with the year included
- **AND** same-month ranges omit repeated month and year text, while cross-year ranges retain both years
- **AND** Tentative dates follows the date range when dates are provisional
- **AND** duration stays together and the base price is more prominent than its complete stored qualification
- **AND** genres precede quieter general types without dropping terms
- **AND** countries use English names instead of ISO codes

#### Scenario: Optional facts are absent

- **WHEN** short description, size, or street address is unknown
- **THEN** no empty row or section is shown for that fact
- **AND** missing ticket and map information follows its explicit fallback rules

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
- **THEN** the opening facts and ticket area use two columns when space permits and one column on narrow screens
- **AND** the reading order is title, known classification tags, dates and status, place, short festival description when known, size, then price and actions
- **AND** detail sections remain below the opening area in one column
- **AND** text remains readable and controls remain reachable without horizontal page scrolling
- **AND** long content and enlarged text can increase the page height without clipping facts or actions

### Requirement: Edition locations have a qualified map

An Edition with coordinates SHALL show one location point in its location section, with attribution and zoom buttons. Initial zoom SHALL reflect stored precision. Wheel scrolling over the map SHALL NOT zoom it. Missing coordinates SHALL leave the place text and Not mapped with the title Map location unavailable, without an empty map.

#### Scenario: A point is approximate

- **WHEN** precision is approximate, locality, region, or unknown
- **THEN** the map uses a broader view than an exact point and explains its location precision
- **AND** the UI does not describe the point as the venue entrance

#### Scenario: The map cannot load

- **WHEN** map configuration, rendering support, or loading fails
- **THEN** a visible map fallback appears
- **AND** the place text, ticket content, history links, and external location link remain usable

### Requirement: Location actions use the Edition point

For an Edition with coordinates, Show on map SHALL move to the page's location section. A labeled external map link SHALL open the saved point. Its accessible name SHALL indicate location uncertainty for non-exact precision. Both actions SHALL be absent without coordinates.

#### Scenario: A visitor follows a location action

- **WHEN** Show on map is activated
- **THEN** the page moves to its own location section
- **AND** the external map action opens a place view rather than a route to a claimed entrance

### Requirement: Event pages provide minimal information and history

The Event page SHALL show its name, the selected festival text, catalog navigation, and links to all public Editions. It SHALL NOT repeat an active Edition detail block, tickets, or a map. Edition pages SHALL show Other editions with the current Edition identified and a Festival overview link to the Event page.

#### Scenario: Several Editions share a year

- **WHEN** a public Edition list contains multiple entries for one year
- **THEN** those entries include their names and dates to distinguish them
- **AND** entries are ordered by start date from newest to oldest, with stable identity order for ties
- **AND** a unique year can use a compact year label

#### Scenario: A visitor moves between Event and Edition history

- **WHEN** a visitor opens an Event page and one of its Edition pages
- **THEN** their history lists use the same ordering, labels, link presentation, and list styles
- **AND** the Edition page marks its current Edition and keeps links to the other public Editions
- **AND** Festival overview appears in Other editions and opens the Event page in a new tab
- **AND** history links retain any matching discovery context

#### Scenario: An Event has historical Editions only

- **WHEN** its Event page opens
- **THEN** the page links to that published history without inventing a next Edition
- **AND** cancelled and postponed public Editions remain reachable

### Requirement: Opening summaries use short festival text

The Edition opening area SHALL show the Event's nonblank short description when known. This text SHALL describe the festival as a whole. Full festival text SHALL remain in About the festival. An absent short description SHALL leave no empty summary row.

#### Scenario: A short description is known

- **WHEN** an Edition opens with both festival description fields present
- **THEN** the short description appears with its opening facts
- **AND** About the festival retains the selected full festival text

#### Scenario: The short description is absent

- **WHEN** an Edition opens without a nonblank short description
- **THEN** no summary row appears in the opening area
- **AND** About the festival retains its existing fallback behavior

### Requirement: Opening ticket actions show their purpose

The opening ticket area SHALL keep base price and its stored conditions together. The opening area SHALL use outlined booking links for a confirmed sell-out with ticket links on an Edition that is not past, cancelled, or postponed. Otherwise, it SHALL emphasize one ticket link for an upcoming Edition that is not cancelled or postponed, with an official-site link as fallback. Other Editions SHALL emphasize an official-site link when known. Ticket and official-site links SHALL share a row when they fit and wrap onto more rows when needed. Category availability SHALL remain in the ticket category section.

#### Scenario: Several purchase and information links exist

- **WHEN** an upcoming scheduled Edition without a confirmed sell-out has ticket, official-site, and social links
- **THEN** one ticket link has primary emphasis and all ticket and official-site links remain in the opening area
- **AND** social links remain below the detail sections

#### Scenario: Base price is unknown

- **WHEN** an Edition has ticket categories but no base price
- **THEN** the opening area states that the price is not available
- **AND** category prices do not supply a base price

#### Scenario: An Edition is cancelled, postponed, or past

- **WHEN** that Edition page opens
- **THEN** its notice remains visible beside the title or dates
- **AND** ticket links remain accessible without primary emphasis
- **AND** past prices and ticket links retain their historical qualification

#### Scenario: The organizer confirms a sell-out
- **WHEN** an Edition with ticket links has a confirmed sell-out and is not past, cancelled, or postponed
- **THEN** its ticket links come first and use the outlined style with the label Sold out
- **AND** the page adds details to distinguish links that have the same label
- **AND** the links keep their destinations and remain active
- **AND** distinct official-site links remain available without primary emphasis

#### Scenario: The catalog has no Edition sell-out confirmation
- **WHEN** all stored ticket categories are sold out but the Edition has no sell-out confirmation
- **THEN** the opening area uses the usual ticket links
