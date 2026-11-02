## MODIFIED Requirements

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

### Requirement: List and map share results and preserve selection

Desktop SHALL show list and map together; narrow screens SHALL offer a keyboard-usable switch. Both SHALL share results. The map SHALL show located results with clustering, precision labels, attribution, and controls; the list SHALL retain unlocated results. A small status SHALL show the total in both views and show mapped and unlocated counts when any result lacks coordinates. Selection SHALL fetch full details with retry and stale-response protection. View switches SHALL preserve filters. Ordinary edition links and list fallback SHALL remain usable.

#### Scenario: Coordinates are missing

- **WHEN** a matching edition has no coordinates
- **THEN** it remains in the list and total count, increases unlocated count, and has no marker

#### Scenario: A detail response arrives late

- **GIVEN** a visitor selects a second edition before the first detail request completes
- **WHEN** the first response arrives later
- **THEN** it cannot replace the second edition's details

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

### Requirement: Discovery uses estimated festival size

Discovery SHALL use sizeEstimate for its existing size bands and thresholds. The Size filter SHALL explain approximate participant numbers; list results SHALL qualify known size as an estimate in people. Unrestricted size SHALL include unknowns; any selected band SHALL exclude them. Size URLs, readable picker values, and all other matching rules SHALL remain unchanged.

#### Scenario: Size filtering
- **WHEN** a size band is selected
- **THEN** estimates on 1000, 5000, 20000, or 50000 enter the band beginning at that value; unknown size is excluded

#### Scenario: Unrestricted size
- **WHEN** no size band is selected
- **THEN** Editions with unknown size remain eligible and show no numeric size
