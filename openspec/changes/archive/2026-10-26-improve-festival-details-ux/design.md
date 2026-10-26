# Design

## Change size

Medium. The work joins public read contracts, discovery selection and return state, detail pages, and two map views. Stored data and write rules do not change. The main risks are lost search context, stale ticket labels, and maps that imply more location precision than the data supports.

## Approach

Use one selected discovery card for quick review and keep full content on the Edition page. Keep the Event page as a name, optional summary, and published Edition list. Both current routes and their aliases remain in use.

Extend the existing public read projection with stored price and location facts. Reuse shared catalog formatting and the current Mapbox dependency. Add a small Edition map rather than embedding the discovery map, which owns clusters, result counts, and selection.

The [proposal](proposal.md) defines scope. The delta specs own [page presentation](specs/website/festival-details/spec.md), [selection and return behavior](specs/website/discovery/spec.md), and [public facts](specs/catalog/publication/spec.md).

## Contracts

`PublicEdition.ticketCategories` currently contains labels and availability. Add optional `amount`, `currency`, and `terms` from `StoredPriceDetail`. Amounts are major currency units; base price amounts remain minor units. Use separate formatting inputs so these units cannot be confused. Do not expose category URLs or spread the stored JSON into the response.

Add nullable `latitude`, `longitude`, and `timeZone`, plus `coordinatePrecision`, to the public detail contract. Replace the redundant `hasCoordinates` flag with a check of the coordinate pair in its consumers. Keep absent values null and preserve exact, approximate, locality, region, and unknown precision. Summary delivery still uses its current compact contract.

The existing public-read test treats all category terms as private. Update that assertion deliberately: stored customer terms now become public, while research reasons, evidence, source summaries, audit data, and category URLs remain private. Publication gates, link inheritance, and validated catalog writes stay unchanged.

Use one request time and the Edition time zone, with UTC fallback, to determine whether `endsOn` precedes today. Move the existing `localToday` and `durationDays` helpers from the discovery model into browser-safe catalog logic so discovery and shared views use the same rules. Pass the same reference time to rendering consumers. `Past edition` is a display qualifier, not a new stored schedule status. Cancelled and postponed notices remain prominent. Suppress only stale Available badges; retain other category states.

## Architecture

```text
SQLite --> catalog/read --> public detail contract
                               |
                               +--> discovery selected card
                               +--> Edition page --> location map
                               +--> Event page --> Edition history links

discovery URL + local view state --> visit snapshot --> detail navigation
                                                        |
                                          Back to results / browser Back
                                                        |
                                      restore context and reload selection
```

`catalog/read` owns field selection and public visibility. Shared catalog components own dates, countries, fact icons, prices, external link controls, and compact history labels. Feature components own section layout and interaction. Routes retain host resolution, aliases, and data loading. Browser components never import database rows.

Keep selection fetching, retry, stale-response protection, and focus return in `use-selected-edition`. Remove only the duplicate selected popup. Keep marker hover previews while no Edition is selected. Dismiss the hover preview when selection starts and suppress it while a selected card is open. Allow hover previews again after the card closes. Keep one card through loading and errors. Add expanded state for the narrow-screen card. List selection must work while the map is hidden or unavailable.

## Key decisions

### Page structure and shared controls

Keep the current font and color tokens. Reduce the Edition heading and vertical gaps. Use one column for all Edition sections at every screen width. Cap the content at a readable width. Do not add separate desktop columns. Keep the document reading order defined in the spec. Place the known Event summary under About the festival.

Use a small shared set of inline SVG outline icons. External destinations remain anchors with visible labels and icons. Use a 32-pixel minimum height, 16-pixel icons, and small text to keep the controls compact. Let buttons and long labels wrap within the available width. Keep title and aria-label names. Visible labels replace the custom hover/focus tooltip rows, so no tooltip state or extra layout is needed. Hide decorative SVGs from assistive technology. The first official-site link uses a globe; further official-site links use an information icon. Deduplicate exact URL strings after the existing official-link inheritance rules. Distinguish repeated link types by stored label or hostname; use the URL when the hostname alone is ambiguous.

Place the card's View link with an arrow in a footer outside the scrolling content. Align it to the bottom-right corner on desktop and narrow screens so it remains reachable during scrolling. Keep the existing navigation handler and discovery token.

Use a fixed desktop card width, capped by the available viewport width. On narrow screens, use one compact height and one expanded height, each capped by the available viewport height. Set these sizes in CSS; exact values remain implementation choices. Keep the agreed expand, collapse, and close controls. Allow internal scrolling when content exceeds the card's available height, and keep required compact facts and actions reachable at 320 CSS pixels and with enlarged text. No drag-to-resize or content-driven card sizing is needed. The map still uses the actual rendered card bounds to keep the selected point visible. Keep the linked title and 44-pixel icon controls in a fixed header outside the scrolling content. Retain the 360-pixel desktop width and the 300/540-pixel mobile heights with their current viewport caps. The header must wrap long titles without horizontal overflow. Keep card styles in one base block and one mobile block. Remove obsolete selectors and overridden declarations while retaining the computed styles.

Shorten date ranges without losing the year or cross-year meaning. Keep duration together and show Tentative dates as a small badge after the date range. Put schedule status beside the date facts in the card. Keep cancellation and postponement notices prominent. Show the base amount with more weight than its full stored qualification. Put genres before quieter general types without discarding terms. Use On map and Not mapped for counts in both discovery views. Use Not mapped beside places without coordinates. Keep Map location unavailable in the title of each Not mapped label. This keeps the visible text short without implying that the place itself is unknown.

### Ticket presentation

Keep the stored category order. Show each category's amount or Price not available, its terms, and allowed availability label. Render zero as Free, including zero without currency. Never infer a category range, coverage, From prefix, or fee condition. Keep full terms on the Edition page; no per-category purchase button is added.

The base price remains an independent summary with its own kind, coverage, and qualification. Its display does not promise current availability. If no base price or category exists, show Ticket information not available once. Historical prices use Prices for this edition. Historical ticket-link names include the Edition year.

### Maps and precision

Reuse Mapbox style and token configuration, attribution, dynamic loading, and visible fallbacks. The new location map owns only one point and its camera. Use a precision-to-zoom table with broader views for locality, region, and unknown precision. Exact zoom values are implementation details to check in Browser. Disable scroll-wheel zoom; keep zoom buttons usable by keyboard.

Show on map links to the location section. Use an external Google Maps place URL built from the saved latitude and longitude, without directions or a claimed entrance. Approximate points use Open approximate location as the visible link label and title. Missing coordinates remove both actions and the map canvas. A rendering failure keeps place text and the external link.

For discovery selection, use the map's projection and camera padding to account for the card's actual bounds. Pan only when the selected point is covered or outside the visible area. Preserve zoom and the camera on close. Do not expand clusters or fit all results just to select an Edition; a selected-point overlay can keep a clustered selection visible without changing zoom. Use a larger point with a contrasting ring. Leave at least 24 CSS pixels between the outer marker and the card; include the marker radius when computing the safe area. Keep marker placement separate from camera movement. A catalog refresh updates or removes the selected marker when coordinates change, without moving the camera.

### Return to discovery

The URL already restores filters and mobile view. It does not restore camera, list scroll, or selection after an ordinary page navigation. Add one discovery visit snapshot containing the normalized root URL, map center and zoom, list scroll position, selected ID, and card expansion state. Store the full snapshot only in session storage, keyed by an opaque context token. Save it before detail navigation and on page exit. Store only the token in a namespaced history-state entry, without a second copy of the snapshot. Preserve framework-owned history fields. Ignore activation of the current view. Save the current snapshot whenever a new visit token is created, even if the other state is unchanged. Browser Back and Back to results use the same restore routine and resolve the snapshot for their own visit token.

Associate explicit detail navigation with an opaque context token in a transient `discovery` query parameter. Carry that token through Event and Edition history navigation within the same visit. Back to results uses the saved root URL and token. Consume the token before normalizing the discovery URL, then remove it. The token is not a filter or part of a canonical record URL. Read only a snapshot from this tab and this configured origin; do not accept a return URL supplied by the query string.

Restore the camera after map readiness and before the ordinary initial fit. Keep list scroll in a ref while the mobile Map view has no list scroll box. Do not replace it with zero from a hidden element. Restore it after results are laid out and the list has a scroll box. Keep a pending scroll value until that box is visible. Enable the mobile view switch after the visit token and snapshot have been read, so an early click cannot replace the return token. A restored selection places its marker without moving the saved camera, including during map and card resize. A new user selection enables the normal point reveal again. Fetch selected detail again rather than storing public detail data in the snapshot. Clear a selection that no longer matches eligible results. A direct detail visit without a matching token uses default discovery even if an unrelated snapshot exists. If storage is unavailable, ordinary links and URL-based filters still work; context restoration is best effort in that restricted browser state.

### Event history and existing routes

Remove the active-Edition section from `EventDetailsPage` and its route's active-selection call. Remove `selectActive`, which then has no production consumer, and its obsolete assertions. Keep the Event summary, published Edition list, and existing breadcrumb relationship. Order history by start date descending with stable ID ties. Use compact years when unique; include name and dates for repeated years. One shared history component owns ordering, labels, links, and list styles for Event and Edition pages. Both pages pass public entries and the discovery token. The Edition page also passes its current Edition ID. Section headings stay in the pages. The Edition list identifies the current page without losing links to other entries.

The latest user decision keeps `/events/{slug}`. Do not add the previously discussed 404 behavior or a redirect to a chosen year. The pending public-site-launch change still targets both route forms; no launch metadata is implemented here.

## Simpler options

Use inline SVGs and existing Mapbox configuration rather than new icon or map dependencies. Keep the new location map separate from discovery, since sharing the entire discovery map would also carry its result and cluster behavior into a one-point view.

Browser history alone cannot support the explicit Back to results link after remount. A tab-local snapshot is needed for the accepted restoration behavior. Keeping only filters would reduce implementation and testing work, but would lose the agreed map position, scroll, and selection.

## Risks and validation

- Price units and field exposure: extend public-read tests with nonzero amounts, zero without currency, missing prices, terms, and private-data exclusions.
- Date boundaries: test an ongoing Edition, an ended Edition, time-zone midnight, and UTC fallback. Confirm cancellation and postponement notices remain visible.
- Navigation: test browser Back and the explicit link, direct entry, remount, several search entries, Event/history navigation, and withdrawn selection. Check query normalization does not erase framework or visit state.
- Maps: use focused tests for precision, missing points, and load-failure fallback without live tiles. Keep the existing unlocated list fallback. Prefer a small real-map end-to-end check for selected points in clusters, card overlap, zoom preservation, and camera restoration before initial fit.
- Real-map setup: the current end-to-end runner and Playwright web server both clear the Mapbox token. Add a simple opt-in mode that forwards a supplied local token through both places; keep the default no-map suite. Document the mode in `docs/development.md`. Do not commit or print the token. If token access, browser rendering, or provider access prevents a simple run, allow partial map checks or omit the live-map check and record the coverage limit. Do not build a map mock system just to replace this check. This limit does not remove the map behavior requirements.
- Accessibility and layout: check visible link labels, keyboard focus, focus return, targets, fixed card actions, long category terms, repeated link types, and narrow-screen overflow.
- Run focused component and integration tests, then the required project checks. Use the built-in Browser for local UI checks. On macOS, shell-launched full Chrome, including headless runners, requires approved execution outside the command sandbox. Do not retry a sandboxed startup crash.

No material product decision remains open. Implementation can choose exact spacing, map zoom values, and responsive breakpoints within these contracts. Treat this change as one delivery. Sync the owning main specs and update the affected guides in one final documentation task after implementation is complete. Run the full project checks after that task; keep focused behavior checks with their implementation tasks.
