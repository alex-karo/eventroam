## Why

The native Month field does not visibly retain its selection. Nearby month buttons make date shortcuts clear and immediate.

## What Changes

- Replace the Month field with six buttons for the current month and next five months, labeled with English month and year and showing selection.
- Remove This weekend and Upcoming and ongoing buttons; retain custom date fields and default matching when dates are cleared.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `website/discovery`: nearby month shortcuts replace the native month picker and weekend shortcut.

## Impact

Discovery filter panel, styles, and browser coverage. No new URL parameters or database changes.
