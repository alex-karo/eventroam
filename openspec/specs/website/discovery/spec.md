# Festival discovery

## Purpose

Define current search, filtering, complete summary delivery, and responsive map/list behavior.

## Requirements

### Requirement: Discovery uses a complete public summary set

Discovery SHALL return all public, non-cancelled, non-postponed Occurrence summaries, including history for explicit date searches. Summaries SHALL include names, dates, filter values, location, optional coordinates, and stable edition links. The response SHALL not paginate or use a map viewport. Browser and server rendering SHALL use the same matching rules. Selection SHALL load full details, while direct links work independently of the map.

#### Scenario: An older edition matches an explicit date range

- **WHEN** a visitor opens a URL for that past range
- **THEN** the edition can appear even though it is absent from the default upcoming results

#### Scenario: The map moves

- **WHEN** a visitor pans or zooms
- **THEN** no new discovery subset is fetched and no result eligibility changes

### Requirement: Filters match the same edition

Discovery SHALL search Event names, aliases, and edition titles without case sensitivity and require every entered search term after trimming whitespace. It SHALL filter by date overlap, country, locality/region, genre ancestry, duration, and capacity bands. Countries, genres, and bands SHALL OR within groups; groups SHALL AND on one Occurrence. Default dates SHALL select upcoming or ongoing editions in the edition's time zone, with UTC fallback. Unknown capacity SHALL match only unrestricted size. Price and availability SHALL not filter or sort.

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

Discovery SHALL filter Occurrences before presentation, return one result per matching edition, and order results by start date, Event name, then stable ID.

#### Scenario: A later edition matches but an earlier one does not

- **WHEN** a filter matches only the later of two editions under one Event
- **THEN** the later edition remains in results and is ordered with other matches by its own start date

### Requirement: Picker choices preserve selected zero-result genres

The genre picker SHALL show known terms represented in eligible summaries together with any selected known term, including parents and children needed for their hierarchy.

#### Scenario: Selected genre has no current result

- **WHEN** a selected genre has zero matching editions after another filter changes
- **THEN** that genre remains available and selected in the picker so the visitor can remove it

### Requirement: Date and duration shortcuts resolve to ordinary bounds

The UI SHALL offer six buttons for the visitor’s current local calendar month and the following five months, labeled with English month and year, plus inclusive custom date selection and one-day, two-to-three-day, and four-or-more-day duration shortcuts. A month button SHALL fill both pending date bounds with that entire calendar month and indicate selection only when both pending bounds exactly match it. The UI SHALL NOT display a native Month field, This weekend button, or Upcoming and ongoing button. Applied shortcuts SHALL serialize as resolved date or duration bounds.

#### Scenario: A nearby month is selected

- **WHEN** a visitor selects a month button
- **THEN** the pending From and To fields show the first and last dates of that month, the button indicates selection, and applying stores those dates in the URL

#### Scenario: Months cross the year boundary

- **WHEN** the current month is December
- **THEN** the six choices start with December of the current year and continue January through May of the next year

### Requirement: Size and duration have deterministic boundaries

Duration SHALL count inclusive programme days from the complete start/end pair. The current size bands SHALL be `lt-1000`, `1000-4999`, `5000-19999`, `20000-49999`, and `gte-50000`, based on the Occurrence's positive capacity estimate. Choosing any size band SHALL exclude unknown capacity; leaving size unrestricted SHALL include it. Results SHALL label capacity as an estimate.

#### Scenario: A capacity is on a band boundary

- **WHEN** capacity is exactly 1,000, 5,000, 20,000, or 50,000
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

Desktop SHALL show list and map together; narrow screens SHALL offer a keyboard-usable switch. Both SHALL share results. The map SHALL show located results with clustering, precision labels, attribution, and controls; the list SHALL retain unlocated results. Counts SHALL distinguish total, mapped, and unlocated results regardless of viewport. Selection SHALL fetch full details with retry and stale-response protection. View switches SHALL preserve filters. Ordinary edition links and list fallback SHALL remain usable.

#### Scenario: Coordinates are missing

- **WHEN** a matching edition has no coordinates
- **THEN** it remains in the list and total count, increases unlocated count, and has no marker

#### Scenario: A detail response arrives late

- **GIVEN** a visitor selects a second edition before the first detail request completes
- **WHEN** the first response arrives later
- **THEN** it cannot replace the second edition's details

### Requirement: Compact controls remain accessible

Name search, filter pickers, applied chips, result count, and Clear all SHALL remain accessible in the compact layout. Apply SHALL commit pending picker values; dismissing SHALL discard them and restore focus. Search SHALL submit by Enter or button, and an invalid search SHALL show associated visible feedback without replacing applied results. The layout SHALL remain usable at 320px. Map loading errors SHALL provide a clear fallback without losing list or filter state.

#### Scenario: Search text is too long

- **WHEN** a visitor submits an overlong name query
- **THEN** visible feedback is associated with the search field and the previous applied URL and results remain

#### Scenario: Controls move to a narrow layout

- **WHEN** the viewport becomes narrow
- **THEN** name search and When and Where remain visible above results, while Music genre, Duration, and Size remain reachable through the filter panel

### Requirement: Discovery does not display aggregate ticket availability
Discovery summaries SHALL omit edition-wide ticket availability. Result lists, map markers, and popups SHALL NOT display aggregate sold-out/closed indicators or infer them from ticket variants. Availability SHALL remain outside filtering and ordering; schedule status rules SHALL remain unchanged.

#### Scenario: Ticket categories have different availability
- **WHEN** an otherwise eligible edition has sold-out, closed, or available ticket categories
- **THEN** it remains discoverable without a sales badge, sold-out marker flag, or availability text in its popup

### Requirement: Applied selections display readable values

Applied chips SHALL show each selected country, genre, and size band separately, and one chip each for a name query, city/region query, date range, and duration range. Labels SHALL use English country names, genre names, readable capacity bounds, and date bounds with years. Duration labels SHALL support one-sided bounds. Only applied values SHALL appear; each removal control SHALL identify its value accessibly.

#### Scenario: Multiple location selections are applied

- **WHEN** Portugal, Spain, and a city/region query of Lisbon are applied
- **THEN** separate removable chips display Portugal, Spain, and Lisbon
- **AND** the overview does not replace those values with a single Where chip

#### Scenario: A direct URL restores filters

- **WHEN** a valid URL specifies dates from 2027-08-01 through 2027-08-31, a known genre, and only durationMin of 4
- **THEN** chips show the actual date range including its year, the genre's display name, and a duration of 4 or more days
- **AND** the same values are restored after reload and browser history navigation

#### Scenario: Pending changes are not yet applied

- **WHEN** a visitor edits values inside a picker
- **THEN** applied chips continue to describe the applied result set until the visitor commits

### Requirement: Removing a selection preserves unrelated filters

Removing a chip SHALL immediately commit removal of only that selection and update the URL and shared results. Removing date or duration chips SHALL clear both bounds of that range; clearing dates SHALL restore upcoming and ongoing matching. Removing a country SHALL retain other countries and the city/region query. Removal SHALL preserve the view preference and leave keyboard focus on a remaining removal control or Clear all.

#### Scenario: One of two countries is removed

- **GIVEN** Portugal, Spain, a city/region query, and a genre are applied
- **WHEN** the visitor removes Spain
- **THEN** only Spain is removed from applied state and the URL
- **AND** Portugal, the city/region query, genre, and view preference remain

#### Scenario: One size or genre is removed

- **WHEN** a visitor removes one chip from multiple selected size bands or genres
- **THEN** other selected values in that group and other groups remain applied

#### Scenario: The final chip is removed with the keyboard

- **WHEN** a keyboard user removes the final applied chip
- **THEN** focus moves to Clear all instead of being lost

### Requirement: Picker actions preview the pending result count

For valid pending filters, each picker SHALL show an updating action labeled "Show N editions", singular for one. N SHALL count all matching editions, including those without coordinates, using the same catalog, time reference, and matching rules as applied results. Previewing SHALL NOT change applied results, chips, or the URL. Applying SHALL commit the previewed filters; dismissing SHALL discard them.

#### Scenario: A preview includes unlocated editions

- **GIVEN** pending filters match two editions with coordinates and one without
- **WHEN** the picker displays its action
- **THEN** the action reads Show 3 editions
- **AND** applying produces three list results and two mapped results if the catalog and time reference have not changed

#### Scenario: Pending filters match no editions

- **WHEN** valid pending filters match zero editions
- **THEN** the enabled action reads Show 0 editions
- **AND** the visitor can apply them or continue editing

#### Scenario: Dismissing a preview retains applied state

- **WHEN** the visitor changes a picker selection and then cancels or presses Escape
- **THEN** applied chips, results, and URL remain unchanged and focus returns to the picker trigger

### Requirement: Invalid pending input does not produce a result count

Incomplete or invalid pending filters SHALL display visible feedback associated with the affected inputs, suppress any numeric preview, and prevent applying. Invalid input SHALL NOT be represented as zero matching editions. Correcting the input SHALL restore the preview. Existing applied results and invalid-direct-URL recovery SHALL remain unchanged by pending edits.

#### Scenario: Only the start date has been entered

- **WHEN** a visitor enters a start date without an end date
- **THEN** the picker explains that a complete date range is needed and does not show a numeric preview
- **AND** entering a valid end date restores the result count without committing the dates

#### Scenario: Duration bounds are reversed

- **WHEN** the pending minimum duration exceeds the maximum
- **THEN** associated feedback explains the invalid bounds and applying is prevented
- **AND** the applied list, map, chips, and URL remain unchanged

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
- **THEN** its English name is shown in the overview and picker, and it remains removable

### Requirement: City or region entry suggests catalog values

The location text field SHALL be labeled City or region and suggest nonempty locality and region values from the discovery catalog, narrowed by typed text and pending countries when selected. Suggestions SHALL be keyboard-operable and identify their country context. Choosing one SHALL set the pending place text without applying it or selecting a country. Free text SHALL remain valid, retaining current substring matching and URL representation.

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
