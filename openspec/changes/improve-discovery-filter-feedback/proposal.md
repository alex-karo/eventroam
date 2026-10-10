# Proposal

## Why

Visitors cannot see their exact selections in the applied-filter overview, predict how many editions pending edits will return, or easily recognize and find countries. Improving these three interactions makes the existing discovery filters easier to understand and adjust without changing catalog matching rules.

## What Changes

- Replace category-only chips with readable selected values. Allow individual countries, genres, and size bands to be removed independently; represent each date range, duration range, name query, and city/region query as its own removable selection.
- Show a live total of matching editions in the picker action, such as "Show 12 editions", before committing pending edits. Preserve explicit Apply/Cancel behavior and handle invalid input separately from zero results.
- Display searchable English country names while retaining ISO country codes in URLs. Rename locality input to "City or region" and offer suggestions from the available catalog, retaining free-text entry and current matching semantics.
- Replace the native Month field with six buttons for the current local month and next five months, labeled with month and year and showing exact-bound selection. Remove This weekend and Upcoming and ongoing buttons while retaining custom dates and default matching when dates are cleared.
- Preserve existing responsive layout, map/list parity, URL restoration, date rules, and filter groups. A unified mobile sheet, zero-result recovery suggestions, genre-tree redesign, new facets, and per-option result counts are outside this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `website/discovery`: Readable, independently removable applied selections; validated pending-result previews; searchable country names and catalog-backed city/region suggestions; visible nearby-month date shortcuts.

## Impact

- Discovery composition, filter panel, presentation helpers, and compact-layout styles under `src/features/discovery/` and `src/app/globals.css`.
- Focused unit coverage and desktop/mobile discovery journeys under `e2e/`.
- Existing public summaries supply all required data. No database migration, API contract change, external geocoder, or new URL parameters are required.
- The main discovery spec will be updated after implementation; this change records future behavior only.
