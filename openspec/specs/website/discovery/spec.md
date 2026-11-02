# Festival discovery

## Purpose

Define current search, filtering, complete summary delivery, and responsive map/list behavior.

## Requirements

### Requirement: Discovery uses a complete public summary set

Discovery SHALL return all public, non-cancelled, non-postponed Edition summaries, including history for explicit date searches. Summaries SHALL include names, dates, filter values, location, optional coordinates, and stable edition links. The response SHALL not paginate or use a map viewport. Browser and server rendering SHALL use the same matching rules. Selection SHALL load full details, while direct links work independently of the map.

#### Scenario: An older edition matches an explicit date range

- **WHEN** a visitor opens a URL for that past range
- **THEN** the edition can appear even though it is absent from the default upcoming results

#### Scenario: The map moves

- **WHEN** a visitor pans or zooms
- **THEN** no new discovery subset is fetched and no result eligibility changes

### Requirement: Filters match the same edition

Discovery SHALL search Event names, aliases, and edition titles without case sensitivity and require every entered search term after trimming whitespace. It SHALL filter by date overlap, country, locality/region, genre ancestry, duration, and size bands. Countries, genres, and bands SHALL OR within groups; groups SHALL AND on one Edition. Default dates SHALL select upcoming or ongoing editions in the edition's time zone, with UTC fallback. Unknown size SHALL match only unrestricted size. Price and availability SHALL not filter or sort.

#### Scenario: Conditions belong to different editions

- **GIVEN** one edition matches a selected country and another edition under the same Event matches a selected genre
- **WHEN** both filters are applied
- **THEN** neither edition matches unless its own facts meet both conditions

#### Scenario: An event overlaps a travel window

- **WHEN** its start is on or before the selected end and its end is on or after the selected start
- **THEN** the edition matches the date range even if it is not wholly inside it

#### Scenario: Two search terms are entered

- **WHEN** a visitor searches for two terms and an edition name contains only one of them
- **THEN** that edition does not match the name query

### Requirement: Discovery orders matching editions deterministically

Discovery SHALL filter Editions before presentation, return one result per matching edition, and order results by start date, Event name, then stable ID.

#### Scenario: A later edition matches but an earlier one does not

- **WHEN** a filter matches only the later of two editions under one Event
- **THEN** the later edition remains in results and is ordered with other matches by its own start date

### Requirement: Picker choices preserve selected zero-result genres

The genre picker SHALL show known terms represented in eligible summaries together with any selected known term, including parents and children needed for their hierarchy.

#### Scenario: Selected genre has no current result

- **WHEN** a selected genre has zero matching editions after another filter changes
- **THEN** that genre remains available and selected in the picker so the visitor can remove it

### Requirement: Date and duration shortcuts resolve to ordinary bounds

The UI SHALL show 12 months from the visitor's current local month above results. Year labels SHALL sit above equal-height month buttons, with a gap between years. All SHALL remain visible outside the horizontal scroll area. Month and All actions SHALL apply at once and preserve other applied filters. All SHALL clear explicit dates and restore upcoming and ongoing matching. Dates SHALL offer inclusive custom bounds. Duration SHALL retain one-day, two-to-three-day, and four-or-more-day shortcuts. Shortcuts SHALL serialize as ordinary bounds.

#### Scenario: A nearby month is selected

- **WHEN** a visitor selects a month button
- **THEN** the URL and results immediately use its first and last dates
- **AND** only the exact applied month indicates selection
- **AND** other applied filters remain unchanged and focus stays on the chosen month

#### Scenario: Months cross the year boundary

- **WHEN** the current month is December
- **THEN** the 12 choices run from December through November of the next year
- **AND** year labels group the choices above one aligned button row without a vertical divider

#### Scenario: All clears a date range

- **GIVEN** explicit dates, a genre, and a country are applied
- **WHEN** All is selected
- **THEN** both date bounds are removed and default upcoming and ongoing matching resumes
- **AND** genre and country remain applied

#### Scenario: The month row exceeds the available width

- **WHEN** all months cannot fit
- **THEN** month buttons remain horizontally scrollable without a visible scrollbar
- **AND** All remains visible and keyboard users can reach every month

### Requirement: Size and duration have deterministic boundaries

Duration SHALL count inclusive programme days from the complete start/end pair. The current size bands SHALL be `lt-1000`, `1000-4999`, `5000-19999`, `20000-49999`, and `gte-50000`, based on the Edition's positive size estimate. Choosing any size band SHALL exclude unknown size; leaving size unrestricted SHALL include it. Results SHALL label size as an estimate.

#### Scenario: A size estimate is on a band boundary

- **WHEN** size is exactly 1,000, 5,000, 20,000, or 50,000
- **THEN** it enters the band beginning at that value

### Requirement: Applied filter URLs are validated and restorable

Applied state SHALL use `q`, `place`, `from`, `to`, repeated `country`, `genre`, and `size`, `durationMin`, `durationMax`, and optional `view`. Serialization SHALL omit defaults and deduplicate repeated values. Date bounds SHALL be complete and ordered; either duration bound MAY be supplied alone, and both SHALL be ordered when present. Country, genre, and size values SHALL be valid. Invalid state SHALL show a recoverable error without broadening results. Reload/history SHALL restore filters; pending edits SHALL stay outside the URL. `view` SHALL be a narrow-screen preference only.

#### Scenario: An invalid direct filter URL is opened

- **WHEN** a date or term value fails validation
- **THEN** the page shows a recoverable error rather than unfiltered results

#### Scenario: A picker is dismissed

- **WHEN** a visitor changes pending selections and cancels
- **THEN** applied filters, URL, and results remain as before

#### Scenario: One duration bound is supplied

- **WHEN** a visitor applies only `durationMin` or only `durationMax`
- **THEN** the URL retains that bound and matching uses it without requiring the other bound

### Requirement: List and map share results and preserve selection

Desktop SHALL show list and map together; narrow screens SHALL offer a keyboard-usable switch. Both SHALL share results. The map SHALL show located results with clustering, precision labels, attribution, and controls; the list SHALL retain unlocated results. A small status SHALL show the total in both views and show mapped and unlocated counts when any result lacks coordinates. Selection SHALL fetch full details with retry and stale-response protection. View switches SHALL preserve filters. Ordinary edition links and list fallback SHALL remain usable.

#### Scenario: Coordinates are missing

- **WHEN** a matching edition has no coordinates
- **THEN** it remains in the list and total count, increases unlocated count, and has no marker

#### Scenario: A detail response arrives late

- **GIVEN** a visitor selects a second edition before the first detail request completes
- **WHEN** the first response arrives later
- **THEN** it cannot replace the second edition's details

### Requirement: Compact controls remain accessible

Name search, filter pickers, result count, and Clear all SHALL remain accessible. One row above results SHALL contain All, scrolling nearby months, and desktop Where, Music, and More controls. Custom dates SHALL be in More. On narrow screens one fixed Filters button SHALL open a bottom sheet with these three groups. Apply SHALL commit the draft; dismissing SHALL discard it and restore focus. Search SHALL submit by Enter or button. Invalid search SHALL show associated visible feedback without replacing applied results. Map loading errors SHALL provide a fallback without losing list or filter state.

#### Scenario: Search text is too long

- **WHEN** a visitor submits an overlong name query
- **THEN** visible feedback is associated with the search field and the previous applied URL and results remain

#### Scenario: Controls move to a narrow layout

- **WHEN** the viewport is 320px wide
- **THEN** All and Filters remain fixed at the edges of one row while nearby months scroll between them
- **AND** years remain above their month groups and all buttons share one baseline
- **AND** Filters opens a bottom sheet with Where, Music, and More

#### Scenario: A mobile sheet is open

- **WHEN** a visitor opens Filters on a narrow screen
- **THEN** keyboard focus stays in the sheet and background controls cannot be activated
- **AND** Escape, Cancel, the close button, or the backdrop dismisses the draft and returns focus to Filters
- **AND** the fields can scroll while group controls and Apply remain available

### Requirement: Discovery does not display aggregate ticket availability
Discovery summaries SHALL omit edition-wide ticket availability. Result lists, map markers, and popups SHALL NOT display aggregate sold-out/closed indicators or infer them from ticket variants. Availability SHALL remain outside filtering and ordering; schedule status rules SHALL remain unchanged.

#### Scenario: Ticket categories have different availability
- **WHEN** an otherwise eligible edition has sold-out, closed, or available ticket categories
- **THEN** it remains discoverable without a sales badge, sold-out marker flag, or availability text in its popup

### Requirement: Applied selections display readable values

Desktop filter buttons SHALL summarize applied values without a separate applied chip row. Where and Music SHALL show the first readable value and the number of other selections. More SHALL identify active date, duration, and size conditions. Full country names, genres, dates with years, and readable duration and size values SHALL remain available in the corresponding picker. Mobile Filters SHALL show the number of active selections.

#### Scenario: Multiple location selections are applied

- **WHEN** Portugal, Spain, and a city/region query of Lisbon are applied
- **THEN** Where summarizes the applied location values
- **AND** opening Where shows each selected country and Lisbon for editing or removal

#### Scenario: A direct URL restores filters

- **WHEN** a valid URL specifies dates from 2027-08-01 through 2027-08-31, a known genre, and only durationMin of 4
- **THEN** Music shows the genre name and More identifies the active date and duration conditions
- **AND** opening More shows the exact dates with years and the one-sided duration
- **AND** the same values are restored after reload and browser history navigation

#### Scenario: Pending changes are not yet applied

- **WHEN** a visitor edits values inside a picker
- **THEN** row buttons continue to describe the applied result set until the visitor commits

### Requirement: Removing a selection preserves unrelated filters

Visitors SHALL remove individual values through the picker controls. Removal SHALL update only the pending draft until Apply. Removing date or duration restrictions SHALL clear both bounds when the visitor clears that condition. Other countries, place text, genres, and view preference SHALL remain unchanged. Desktop Clear all SHALL reset applied filters. Clear all inside the sheet SHALL clear the pending draft, including the name query.

#### Scenario: One of two countries is removed

- **GIVEN** Portugal, Spain, a city/region query, and a genre are applied
- **WHEN** the visitor deselects Spain in Where and applies
- **THEN** only Spain is removed from applied state and the URL
- **AND** Portugal, the city/region query, genre, and view preference remain

#### Scenario: One size or genre is removed

- **WHEN** a visitor removes one of multiple selected size bands or genres and applies
- **THEN** other selected values in that group and other groups remain applied

#### Scenario: A cleared draft is cancelled

- **WHEN** a visitor clears all values inside the sheet and then cancels
- **THEN** applied values, the name query, and the URL remain unchanged

#### Scenario: The final chip is removed with the keyboard

- **WHEN** a keyboard user removes the final selected genre chip in Music
- **THEN** focus stays inside the picker on the genre search field
- **AND** removal remains pending until Apply

### Requirement: Picker actions preview the pending result count

For valid pending filters, each picker SHALL show an action with the current matching result count. The count SHALL include all matching editions, including those without coordinates, using the same catalog, time reference, and matching rules as applied results. Previewing SHALL NOT change applied results, row summaries, or the URL. Applying SHALL commit the previewed filters; dismissing SHALL discard them.

#### Scenario: A preview includes unlocated editions

- **GIVEN** pending filters match two editions with coordinates and one without
- **WHEN** the picker displays its action
- **THEN** the action shows three matching results
- **AND** applying produces three list results and two mapped results if the catalog and time reference have not changed

#### Scenario: Pending filters match no editions

- **WHEN** valid pending filters match zero editions
- **THEN** the enabled action shows zero matching results
- **AND** the visitor can apply them or continue editing

#### Scenario: Dismissing a preview retains applied state

- **WHEN** the visitor changes a picker selection and then cancels or presses Escape
- **THEN** applied row summaries, results, and URL remain unchanged and focus returns to the picker trigger

### Requirement: Invalid pending input does not produce a result count

Incomplete or invalid pending filters SHALL display visible feedback associated with the affected inputs, suppress any numeric preview, and prevent applying. Invalid input SHALL NOT be represented as zero matching editions. Correcting the input SHALL restore the preview. Existing applied results and invalid-direct-URL recovery SHALL remain unchanged by pending edits.

#### Scenario: Only the start date has been entered

- **WHEN** a visitor enters a start date without an end date
- **THEN** the picker explains that a complete date range is needed and does not show a numeric preview
- **AND** entering a valid end date restores the result count without committing the dates

#### Scenario: Duration bounds are reversed

- **WHEN** the pending minimum duration exceeds the maximum
- **THEN** associated feedback explains the invalid bounds and applying is prevented
- **AND** the applied list, map, row summaries, and URL remain unchanged

#### Scenario: A native input contains an unfinished value

- **WHEN** a date or duration input contains a partially entered date or malformed number that the browser reports as invalid, even if its exposed value is empty
- **THEN** the picker suppresses the numeric preview and prevents applying with a corrective message
- **AND** correcting or fully clearing the input restores the preview when the remaining filters are valid

### Requirement: Country choices are readable and searchable

The country picker SHALL display English names for countries represented in the discovery catalog together with selected valid countries. A country search SHALL narrow choices by case-insensitive name or ISO code without changing selections or discovery results. Selected countries SHALL remain visible and removable when absent from search matches or catalog results. Applied URLs SHALL retain ISO codes.

#### Scenario: Search by name or code

- **WHEN** a visitor searches country choices for Portugal or PT
- **THEN** Portugal can be selected in either case
- **AND** applying serializes country=PT rather than a display name

#### Scenario: Selected countries remain visible during search

- **GIVEN** Spain is already selected
- **WHEN** a visitor searches country choices for Portugal
- **THEN** Spain remains visible as selected and removable while Portugal appears as a matching choice
- **AND** searching alone neither applies nor removes either selection

#### Scenario: A selected country has no catalog editions

- **WHEN** a valid direct URL selects a country absent from the current catalog
- **THEN** its English name is shown in the Where button and picker, and it remains removable

### Requirement: City or region entry suggests catalog values

The location text field SHALL be labeled City or region and suggest nonempty locality and region values from the discovery catalog, narrowed by typed text and pending countries when selected. Suggestions SHALL be keyboard-operable, keep the active keyboard option visible, and identify their country context. Choosing one SHALL set the pending place text without applying it or selecting a country. Free text SHALL remain valid, retaining substring matching and URL representation. Place queries and catalog place text SHALL use the same whitespace normalization when matching.

#### Scenario: Suggestions respect pending countries

- **WHEN** Portugal is selected in the picker and the visitor types a prefix matching a Portuguese catalog locality
- **THEN** matching suggestions come from Portuguese catalog entries and display their country context
- **AND** choosing a suggestion updates only the pending City or region value

#### Scenario: A visitor uses an unlisted place query

- **WHEN** the visitor enters valid text with no suggestions
- **THEN** the text can still be applied and serialized as place
- **AND** matching remains case-insensitive against locality and region text, including a possible zero-result outcome

#### Scenario: A catalog place exceeds the search limit

- **WHEN** a catalog locality or region exceeds 200 characters after search-text normalization
- **THEN** it is omitted from selectable suggestions rather than truncated
- **AND** a matching value of exactly 200 characters remains eligible, and visitors can still enter a shorter free-text query

#### Scenario: Country changes leave place text intact

- **WHEN** pending countries change after a city/region query was entered
- **THEN** suggestions and preview counts update but the query is not silently cleared or replaced

#### Scenario: A keyboard user chooses a suggestion

- **WHEN** a visitor navigates suggestions with the keyboard and confirms one
- **THEN** its place text is entered without submitting the picker
- **AND** dismissing the suggestion list preserves the typed text

### Requirement: Discovery uses estimated festival size

Discovery SHALL use sizeEstimate for its existing size bands and thresholds. The Size filter SHALL explain approximate participant numbers; list results SHALL qualify known size as an estimate in people. Unrestricted size SHALL include unknowns; any selected band SHALL exclude them. Size URLs, readable picker values, and all other matching rules SHALL remain unchanged.

#### Scenario: Size filtering
- **WHEN** a size band is selected
- **THEN** estimates on 1000, 5000, 20000, or 50000 enter the band beginning at that value; unknown size is excluded

#### Scenario: Unrestricted size
- **WHEN** no size band is selected
- **THEN** Editions with unknown size remain eligible and show no numeric size

### Requirement: Selection uses one compact festival card

Discovery SHALL show one selected card shared by list and map. A selected marker SHALL be highlighted without a duplicate popup. The card SHALL show name, dates, duration, place, useful terms, known estimated size, base price, and external links. Full descriptions and ticket categories SHALL remain on the Edition page.

#### Scenario: A visitor selects an Edition

- **WHEN** a marker or list selection is activated
- **THEN** the same card shows the selected Edition
- **AND** its title and a visible View action link to the Edition page
- **AND** provisional dates are qualified next to the date facts
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
- **AND** card size adapts to the space available for content and map interaction
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

Discovery SHALL show a small total result count below the list, without a summary block above event rows. The status SHALL also remain available in mobile map view. When results lack coordinates, it SHALL show On map and Not mapped counts. Each Not mapped label SHALL have the title Map location unavailable. When all results are mapped, the total alone SHALL be sufficient.

#### Scenario: A result has no coordinates

- **WHEN** matching results include an Edition without coordinates
- **THEN** the small result status uses On map and Not mapped for coverage
- **AND** its list entry uses Not mapped with the title Map location unavailable

#### Scenario: All results are mapped

- **WHEN** every matching result has coordinates
- **THEN** the result status shows the total without extra map statistics
- **AND** event rows start directly below the shared filter row

### Requirement: Genre choices use a compact searchable tree

Music SHALL show a single-column tree with separate checkbox and branch controls. Search SHALL show matching names and their ancestor paths without changing selections or results. Selected genres SHALL remain removable during search. The list SHALL scroll within a bounded picker while search and Apply remain visible. The picker SHALL retain the existing preview and cancel rules.

#### Scenario: A deep genre matches search

- **WHEN** a visitor searches for Deep House
- **THEN** the picker shows Electronic, House, and Deep House when those terms are eligible
- **AND** searching and opening branches do not change pending or applied selections

#### Scenario: A branch has selected descendants

- **WHEN** a child genre is selected without its parent
- **THEN** the parent checkbox shows partial selection and the row shows its selected descendant count
- **AND** collapsing the parent preserves that selection

### Requirement: Genre branch selection includes descendants

Selecting a parent SHALL include its descendants through the existing ancestry matching rule. Selecting a parent SHALL replace redundant pending descendant selections. Descendants covered by a selected ancestor SHALL show checked, disabled controls and an Included label. Removing the parent SHALL make those descendants available again. Clear SHALL remove pending genre restrictions only.

#### Scenario: A visitor selects the whole Electronic branch

- **GIVEN** Deep House and Techno are pending selections
- **WHEN** Electronic is selected
- **THEN** Electronic replaces those pending selections
- **AND** its visible children are checked and identified as included
- **AND** applying uses the existing parent genre matching rule

#### Scenario: A selected genre is outside search matches

- **WHEN** the search excludes a selected genre
- **THEN** the selected genre remains available in the selection summary for removal
- **AND** removal changes only pending genres until Apply

#### Scenario: A direct URL selects a parent and child

- **GIVEN** both Electronic and Techno are in the applied URL
- **WHEN** Electronic is removed in the picker
- **THEN** both pending slugs are removed from that branch
- **AND** cancelling leaves the original URL unchanged

### Requirement: Switching filter groups retains the pending draft

Switching between Where, Music, and More SHALL retain valid or invalid pending edits in the same draft. More SHALL contain custom dates, duration, and size. Apply SHALL commit the complete draft. Cancel, Escape, or closing the active picker SHALL discard it. A month or All action SHALL use applied filters and close the draft when those controls are available.

#### Scenario: A visitor changes two groups

- **WHEN** a visitor selects Portugal, switches to Music, selects a genre, and applies
- **THEN** both pending selections are committed together
- **AND** cancelling instead would preserve the previous applied state

#### Scenario: Native input is unfinished during a group switch

- **WHEN** a visitor leaves an unfinished native date or number in More and switches groups
- **THEN** applying stays disabled until that input is completed or cleared
- **AND** returning to More keeps the unfinished input available for correction
