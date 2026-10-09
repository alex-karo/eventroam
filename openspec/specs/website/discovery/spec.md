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

The UI SHALL offer a weekend, month-with-year, and inclusive custom date selection, plus one-day, two-to-three-day, and four-or-more-day duration shortcuts. Applied shortcuts SHALL serialize as resolved date or duration bounds.

#### Scenario: This weekend is applied

- **WHEN** a visitor applies the weekend shortcut
- **THEN** the URL stores its resolved Saturday and Sunday dates rather than a relative keyword

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
