# Proposal

## Why

The map popup and selected panel repeat the same facts and cover the map. The Edition page presents storage-style fields, but it does not show category prices or a map of the place.

## What Changes

- Use one selected card on the map. Keep marker hover previews when no card is selected. Use a side panel on desktop and an expandable bottom panel on narrow screens. Keep the selected point visible without changing zoom.
- Make the Edition page the main detail page with one column at all screen widths. Show clear dates, place, description, ticket categories, a location map, and other Editions.
- Keep the Event page as a small overview with its name, optional summary, and published Edition list. Remove its separate active-Edition detail block. Both existing route forms remain available. Use the same history list presentation on Event and Edition pages, with the current Edition marked on its own page.
- Keep a compact card header visible during content scrolling. Keep View as the primary action in the bottom-right corner, visible during content scrolling. Use shorter dates followed by Tentative dates when needed, separate duration, and clear price hierarchy. Keep status near dates and give genres more weight than general types.
- Give the selected map point a clear outline and space from the card. Use compact map coverage labels in both views.
- Use one outline icon set for key facts. Show external links as smaller buttons with icons, visible labels, and accessible names.
- Expose stored category amounts, currencies, and terms. Keep the base price separate from category availability. Mark past prices as historical and hide stale Available labels.
- Restore discovery filters, view, map position, list scroll, and selection when a visitor returns from a detail page.
- Keep the current colors and font. Reduce large headings and gaps. Use existing data; photos, lineup, camping, transport, and new category price structures are outside this change.

## Capabilities

### New Capabilities

- `website/festival-details`: Edition page layout, location map, external link controls, and compact Event history page.

### Modified Capabilities

- `catalog/publication`:
  - **Before**: The Event page shows a selected active Edition. Public ticket categories expose only labels and availability. Known availability is shown without a past-Edition exception.
  - **After**: The Event page shows minimal information and published history. Edition reads also expose safe category price fields and map precision. Past Editions suppress Available labels and qualify prices as historical.
- `website/discovery`:
  - **Before**: Selection loads full details; the spec does not define a single-card layout or restoration of map position and selection after detail navigation. The code shows both a popup and a full panel.
  - **After**: One compact selected card replaces the duplicate selected popup and panel. Marker hover previews remain available without selection. Navigation to an Edition and back restores the visitor's discovery context.

## Impact

The change affects `catalog/read`, shared catalog views, `features/discovery`, `features/event-details`, global styles, and their tests. It adds a small Edition map that uses the existing Mapbox setup. It needs no database migration or ingestion contract change. Public detail DTOs will expose selected stored fields; private research and audit data remain excluded.

The existing Event and Edition routes, host rules, and rename aliases stay in use. The pending `public-site-launch` change must use the compact Event page and the main Edition page when it later adds metadata. This change does not implement that launch work.
