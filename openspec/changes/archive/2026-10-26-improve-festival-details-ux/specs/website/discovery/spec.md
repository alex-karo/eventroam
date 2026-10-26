# Spec Delta

## ADDED Requirements

### Requirement: Selection uses one compact festival card

Discovery SHALL show one selected card shared by list and map. A selected marker SHALL be highlighted without a duplicate popup. The card SHALL show name, dates, duration, place, useful terms, known estimated size, base price, and external links. Full descriptions and ticket categories SHALL remain on the Edition page.

#### Scenario: A visitor selects an Edition

- **WHEN** a marker or list selection is activated
- **THEN** the same card shows the selected Edition
- **AND** its title and a visible View action link to the Edition page
- **AND** provisional dates and approximate locations are qualified next to those facts
- **AND** View is the primary action in the bottom-right corner of the card
- **AND** duration stays together, provisional dates use a badge after the date range, and schedule status sits beside date facts
- **AND** the base amount is more prominent than its full qualification, while genres precede quieter general types
- **AND** no category or aggregate ticket availability appears in the card

#### Scenario: A visitor changes selection quickly

- **WHEN** another Edition is selected during detail loading
- **THEN** the existing card updates its loading state without adding another card
- **AND** late responses cannot replace the latest selection
- **AND** load errors keep a retry action

#### Scenario: A visitor hovers over a marker

- **WHEN** no Edition is selected and the visitor hovers over a marker
- **THEN** the existing short hover preview remains available
- **AND** selecting an Edition dismisses the preview and suppresses hover previews while the selected card is open
- **AND** closing the card allows hover previews again

### Requirement: Selected cards adapt to screen width

Desktop discovery SHALL use a side card. Narrow screens SHALL use a bottom card with accessible expand, collapse, and close controls. New selection SHALL first show its compact state on narrow screens. Name, dates, place, and View SHALL be visible before expansion.

#### Scenario: A visitor expands a mobile card

- **WHEN** the expand control is activated
- **THEN** the same card also shows terms, known estimated size, base price, and external links
- **AND** the visitor can collapse or close it without changing filters

#### Scenario: Card content exceeds its available space

- **WHEN** long content, a small viewport, or enlarged text exceeds the card's available height
- **THEN** the card stays within the viewport and its content can scroll
- **AND** the linked title and 44-pixel icon controls stay visible above the scrolling content
- **AND** View stays visible in the bottom-right corner outside the scrolling content
- **AND** the fixed desktop width and compact and expanded mobile sizes remain unchanged
- **AND** required compact facts, navigation, and card controls remain reachable

#### Scenario: A visitor uses list view without a working map

- **WHEN** an Edition is selected in the list
- **THEN** its card and ordinary Edition link remain usable without a map

### Requirement: Selection keeps the map context

Selecting a located result SHALL pan only as needed to show its point outside the selected card. Selection SHALL preserve zoom. Closing the card SHALL preserve the map position. Selecting an unlocated result SHALL NOT move the map to a made-up point.

#### Scenario: A selected point is covered

- **WHEN** the selected card covers the point
- **THEN** the map pans enough to reveal the point without changing zoom
- **AND** the selected marker has a contrasting ring and at least 24 CSS pixels of clear space from the card
- **AND** closing the card does not fit all results or reset the camera

#### Scenario: Selected coordinates change during a catalog refresh

- **WHEN** refreshed catalog data changes the selected Edition's coordinates
- **THEN** its selected marker moves to the new point without changing the camera
- **AND** removing its coordinates removes the selected marker without clearing the card

### Requirement: Detail navigation preserves discovery context

Returning from festival detail navigation SHALL restore applied filters, mobile view, map position and zoom, list scroll, and selected Edition. Back to results SHALL return to that context. A detail page opened without a saved discovery context SHALL link to default discovery.

#### Scenario: A visitor returns to a search

- **WHEN** a visitor opens an Edition from filtered discovery and returns with browser Back or Back to results
- **THEN** the prior discovery context is restored
- **AND** the selected detail is loaded again under current public visibility rules

#### Scenario: A visitor activates the current view again

- **WHEN** a visitor activates the already active List or Map control
- **THEN** the current visit and browser history entry remain unchanged
- **AND** Back and Forward between actual view changes retain selection, expansion, list scroll, and camera

#### Scenario: A mobile visitor returns to Map and then List

- **WHEN** a visitor scrolls the mobile list, selects an Edition, switches to Map, opens details, and returns through either return path
- **THEN** Map view and the selection are restored
- **AND** switching to List restores its prior scroll position

#### Scenario: A visitor has moved away from the selected point

- **WHEN** a visitor pans the selected point off screen before opening details and returning
- **THEN** the saved map center and zoom are restored without a selection reveal pan
- **AND** the selection remains available and a new user selection can reveal its point

#### Scenario: Selected detail changes during navigation

- **WHEN** public detail content changes before browser Back or Back to results
- **THEN** the restored card shows the new public content rather than a saved detail payload

#### Scenario: Saved selection is no longer eligible

- **WHEN** restored discovery no longer contains the selected Edition
- **THEN** filters, view, map position, and scroll are restored where possible
- **AND** the obsolete selection is cleared without broadening filters

#### Scenario: A detail URL opens directly

- **WHEN** there is no discovery context for this visit
- **THEN** Back to results points to default discovery
- **AND** another search from an unrelated detail visit is not restored

### Requirement: Map coverage labels are consistent

Discovery SHALL use On map and Not mapped for coverage counts in both list and map views. Missing-point labels SHALL use Not mapped. Each Not mapped label SHALL have the title Map location unavailable.

#### Scenario: A result has no coordinates

- **WHEN** matching results include an Edition without coordinates
- **THEN** both coverage summaries use the same labels and counts
- **AND** its list entry uses Not mapped with the title Map location unavailable
