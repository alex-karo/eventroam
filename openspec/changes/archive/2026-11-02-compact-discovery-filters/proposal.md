# Proposal

## Why

Large filter panels hide the map and make a long genre tree hard to scan. The user approved a permanent month row and a compact genre picker after testing the designs.

## What Changes

- Put 12 months above the results. Group month buttons by year, add All, and apply date shortcuts at once.
- Keep Where, Music, Dates, and More visible on desktop and narrow screens.
- Replace the genre tile grid with one searchable column and separate branch controls.
- Show selected genres, partial parent selection, and inherited selection. Keep the apply action outside the scrolling list.
- Retain matching rules, readable chips, pending previews, URL state, and map/list context.

## Capabilities

### Modified Capabilities

- `website/discovery`:
  - **Before**: Six month shortcuts edit pending bounds inside When. Narrow screens put genres in the general filter panel. Genre choices show the eligible hierarchy without a search requirement.
  - **After**: Twelve month shortcuts stay above results and apply at once. All clears explicit dates. A compact Music picker supports search and branches on all screen sizes.

## Impact

Medium: this change joins filter state, layout, and keyboard behavior. It affects discovery components, styles, and focused tests. Existing matching, catalog APIs, and dependencies remain in use. All restores the existing default upcoming and ongoing date rule. It does not expose all past editions.
