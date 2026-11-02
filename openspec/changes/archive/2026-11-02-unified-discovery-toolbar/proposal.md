# Proposal

## Why

The month row and list summary use too much space above the events. The visitor has approved one row for months and filters, with a small result count below the list.

## What Changes

- Combine the month row with Where, Music, and More on desktop. Show applied values in these buttons.
- Put custom dates in More. Keep All and months visible.
- Use one fixed Filters button beside the scrolling months on mobile. Open a bottom sheet with Where, Music, and More.
- Remove the applied chip row above the list. Edit or remove values in the pickers, then apply the draft.
- Move the result count and map coverage to a small status area below the list.
- Keep matching, URLs, search, history, and the genre tree unchanged.

## Capabilities

### Modified Capabilities

- `website/discovery`:
  - **Before**: A permanent month row sits above results. Four picker buttons and applied chips remain accessible. Removing an applied chip commits at once.
  - **After**: One row contains months and filter buttons. Mobile uses one Filters button and a bottom sheet. Dates belong to More. Picker values replace the applied chip row, and picker edits stay pending until Apply. Counts move below the list.

## Impact

Medium change. Layout, picker navigation, native input lifetime, and focus are coupled. Update Discovery, MonthStrip, FilterPanel, styles, and browser journeys. No API, matching, storage, or dependency change is needed.
