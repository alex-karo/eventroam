# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Date and duration shortcuts resolve to ordinary bounds

The UI SHALL offer six buttons for the visitor’s current local calendar month and the following five months, labeled with English month and year, plus inclusive custom date selection and one-day, two-to-three-day, and four-or-more-day duration shortcuts. A month button SHALL fill both pending date bounds with that entire calendar month and indicate selection only when both pending bounds exactly match it. The UI SHALL NOT display a native Month field, This weekend button, or Upcoming and ongoing button. Applied shortcuts SHALL serialize as resolved date or duration bounds.

#### Scenario: A nearby month is selected

- **WHEN** a visitor selects a month button
- **THEN** the pending From and To fields show the first and last dates of that month, the button indicates selection, and applying stores those dates in the URL

#### Scenario: Months cross the year boundary

- **WHEN** the current month is December
- **THEN** the six choices start with December of the current year and continue January through May of the next year
