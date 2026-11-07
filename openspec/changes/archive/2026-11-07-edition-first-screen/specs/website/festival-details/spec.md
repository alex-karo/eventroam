# Spec Delta

## MODIFIED Requirements

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

### Requirement: Key fact icons support compact reading

Festival cards and Edition pages SHALL use consistent outline icons for dates, place, tickets, and known estimated size. Icons beside visible fact text SHALL be decorative. The UI SHALL retain the current font and colors, use smaller headings and gaps, and remain usable at 320 CSS pixels.

#### Scenario: The page width changes

- **WHEN** an Edition page is viewed on a narrow or wide screen
- **THEN** the opening facts and ticket area use two columns when space permits and one column on narrow screens
- **AND** the reading order is title, known classification tags, dates and status, place, short festival description when known, size, then price and actions
- **AND** detail sections remain below the opening area in one column
- **AND** text remains readable and controls remain reachable without horizontal page scrolling
- **AND** long content and enlarged text can increase the page height without clipping facts or actions

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

## ADDED Requirements

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

The opening ticket area SHALL keep base price and its stored conditions together. It SHALL emphasize one ticket link for an upcoming Edition that is not cancelled or postponed, with an official-site link as fallback. Other Editions SHALL emphasize an official-site link when known. Category availability SHALL remain in the ticket category section.

#### Scenario: Several purchase and information links exist

- **WHEN** an upcoming scheduled Edition has ticket, official-site, and social links
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
