## MODIFIED Requirements

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

### Requirement: Compact controls remain accessible

Name search, filter pickers, applied chips, result count, and Clear all SHALL remain accessible in the compact layout. Apply SHALL commit pending picker values; dismissing SHALL discard them and restore focus. Search SHALL submit by Enter or button, and an invalid search SHALL show associated visible feedback without replacing applied results. The layout SHALL remain usable at 320px. Map loading errors SHALL provide a clear fallback without losing list or filter state.

#### Scenario: Search text is too long

- **WHEN** a visitor submits an overlong name query
- **THEN** visible feedback is associated with the search field and the previous applied URL and results remain

#### Scenario: Controls move to a narrow layout

- **WHEN** the viewport becomes narrow
- **THEN** name search, the month row, and Where, Music, Dates, and More remain reachable above results


## ADDED Requirements

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

Switching between Where, Music, Dates, and More SHALL retain valid or invalid pending edits in the same draft. Apply SHALL commit the complete draft. Cancel, Escape, or closing the active picker SHALL discard it. A month or All action SHALL use applied filters and close the draft.

#### Scenario: A visitor changes two groups

- **WHEN** a visitor selects Portugal, switches to Music, selects a genre, and applies
- **THEN** both pending selections are committed together
- **AND** cancelling instead would preserve the previous applied state

#### Scenario: Native input is unfinished during a group switch

- **WHEN** a visitor leaves an unfinished native date or number and switches groups
- **THEN** applying stays disabled until that input is completed or cleared
- **AND** returning to its group keeps the unfinished input available for correction
