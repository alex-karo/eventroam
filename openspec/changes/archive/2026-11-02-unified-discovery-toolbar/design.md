# Design

## Change size

Medium. The row, picker lifetime, result status, and responsive focus behavior change together. Matching, URLs, catalog data, and dependencies stay the same.

## Approach

Discovery keeps the applied filters and one pending draft. Its top row contains MonthStrip and Where, Music, and More. On narrow screens these three triggers become one Filters button. The existing FilterPanel gains group tabs and opens as a bottom sheet. Custom dates move into More.

The list starts with event rows, without an applied chip overview. Buttons show the first applied country or genre and the number of other values. More shows the number of active date, duration, and size conditions. Full values remain in the picker fields. A small status area below the results holds the total and any missing-location count.

## Contracts

The picker group type becomes `where | genre | more`. Picker edits, removals, and Clear all remain pending until Apply. Desktop Clear all resets the applied filters at once. All still clears only dates at once. A month still uses applied filters and discards an open draft. Dates and duration use the existing validation and URL fields.

## Key decisions

- Keep one mounted picker and hide inactive groups. Native unfinished date or number values must survive a group switch. Move the date fields into More without changing the matching model.
- Use the native dialog API. Show a nonmodal picker on desktop and a modal sheet on mobile. The browser supplies modal focus containment, the backdrop, and inert background controls. Reuse the same dialog across width changes so native edits survive. Return focus to the visible trigger after closing.
- Keep month controls 44px high in both pointer modes. The earlier mobile history regression showed that pointer mode can change during pagehide. Stable geometry prevents that change from moving saved list scroll.
- Keep All and Filters outside the horizontal month scroller. At 320px the months use the remaining width. All buttons share one baseline, and years sit above their groups.
- Use the existing filter selection labels for the desktop button summary. Do not add another representation of catalog terms. Group tabs expose every filter on mobile. Clear all in the sheet clears the whole pending draft, including the name query.

## Simpler options

Keep existing React filter ownership, tree search, and location suggestions. Do not add a second mobile form or custom focus trap. Keeping the old chip overview would retain the space problem, so it is removed as approved in the mockup.

## Risks and validation

- Dialog mode changes can move focus or lose a native edit. Check keyboard focus, backdrop, Escape, group switching, and resizing with a browser.
- Shared row width and long values can hide months or controls. Check 320px and desktop with many selected genres and long labels. Only the month area can scroll horizontally.
- Moving the status can affect history scroll. Run the existing detail return and view-switch tests.
- Update filter browser journeys to open the mobile sheet and use More for dates. Keep the existing invalid-input, pending-preview, matching, and history checks. Add focused coverage for the new row and mobile dialog behavior.
