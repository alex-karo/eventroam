# V1 discovery filters

Date: 2026-10-02 · Status: Selected scope, complete summary loading, and compact responsive map/list layout; size bands remain proposed defaults

Support **When, Where, Music genre, Duration, and Size**, plus name search. Exclude Experience, Setting, and date-confirmation controls. Defer price, camping, and other practical filters. Continue collecting [festival information](003-festival-information.md), including prices in original currencies.

This replaces earlier filter recommendations; [domain rules](001-domain-model.md) and [taxonomy definitions](002-festival-taxonomy.md) still apply.

## Placement and interaction

### Compact discovery presentation (2026-10-02)

Implement the approved compact proposal: a slim brand/scope header with name search, a dense edition list on the left (about 40%) and a map on the right filling the remaining viewport. Remove the introductory heading block and redundant Map/List headings. Float the compact filter strip and its on-demand panel over the map on desktop; keep result counts and applied chips with the list. Panels must not obscure their own Apply/Cancel controls, and must restore focus to their opener. On narrow screens reserve a compact control area above list rows and provide a readily accessible floating Map/List switch. Keep content usable at 320px and with keyboard navigation.

Use the proposal's restrained teal palette and expressive brand typography. Map points should be approximately 9px visually with larger pointer/touch hit areas, a distinct selected state, and names/status in a hover preview or selected details. Place zoom/fit controls in a map corner. Preserve Mapbox attribution, approximate-location labels, clustering, and all coordinate-bearing results. Details open in a compact contextual panel with the linked public edition page still available.

This presentation change keeps the existing catalog/API/URL contracts and unknown-value semantics. Search, filters, Apply/Cancel, browser history, retry handling and stale-response protection must retain their behavior. No data migration, new collection fields, animations, or mock-only detail features are required. Map configuration/loading failures retain a useful list and clear fallback. Roll out as the default discovery layout; verify standard checks plus desktop/mobile layout, filter application/cancellation, selection, and view switching against fictional fixtures.

Compact row styling is confined to discovery; public Event history retains its document layout. On mobile, fit/zoom and Map/List controls share a bottom row above attribution, with the applied summary growing upward above that row. Search validation feedback remains visible and associated with the search field whether filter pickers are open or closed; invalid submissions preserve the applied URL/results. Regression checks cover public history, wrapped chips at 320px, and overlong name searches in both views.

| Placement | Desktop | Mobile |
| --- | --- | --- |
| Always visible | Name search, When, Where, Music genre | Name search, When, Where |
| Secondary panel | Duration, Size | Music genre, Duration, Size |

Label the panel button “More filters” on desktop and “Filters” on mobile; count active groups inside it. Keep applied chips, result count, and Clear all visible outside the panel. Desktop shows map and list together. Mobile and other narrow layouts show one view at a time with an easy, prominent Map/List switch outside the panel. Switching or resizing preserves filters and the selected edition.

Pickers/panel use Apply; dismissing discards pending edits. Submit search with Enter or its button. Clear all resets every filter, including name search. Support keyboard operation, focus restoration, announced counts, and narrow screens without requiring map interaction.

## Controls

**Name:** case-insensitive search across Event names, aliases, and edition titles. Trim whitespace and require all entered terms. Search intersects the current filters; fuzzy, lineup, and description search are deferred.

**When:** default to upcoming/ongoing. Offer This weekend, month with year, and an inclusive custom range. Match overlap: `startsOn <= requestedEnd && endsOn >= requestedStart`; explain that an event need not fit entirely inside the range. Explicit ranges replace the default window and can find completed editions. Resolve weekend to the current/next Saturday–Sunday using the visitor's date; store actual dates in the URL. Compare event-local calendar dates, not converted UTC midnights. Default eligibility uses the event time zone, falling back to UTC when unknown. Include labeled tentative dates; always exclude cancelled/postponed editions from discovery.

**Where:** multiple countries plus optional case-insensitive locality/region text. No “Search this area,” bounding-box filter, or viewport-driven discovery requests. Panning and zooming change only presentation, never result eligibility. Approximate points retain their labels; unlocated editions remain in the list regardless of viewport. Radius, geolocation, and routing are deferred.

**Music genre:** multi-select known terms represented in eligible inventory, with children grouped under parents. Preserve selected terms even at zero results. Parents include descendants under the taxonomy: Electronic includes Psytrance; Trance does not. Unrestricted genre includes unknown genres and non-musical gatherings.

**Duration:** optional inclusive minimum/maximum positive integer days, with 1 day, 2–3 days, and 4+ days shortcuts filling those inputs. Derive `endsOn - startsOn + 1` from the entire programme, not its overlap with travel dates or camping windows. Display dates alongside duration; tentative dates imply tentative duration.

**Size:** multi-select attendee-capacity bands: **under 1,000; 1,000–4,999; 5,000–19,999; 20,000–49,999; 50,000+**. Help text: “Estimated attendee capacity.” Use only supported positive `capacityEstimate` values; label estimates and never infer a point from a source range. Unrestricted size includes unknowns; any selected band excludes them, even if all bands are selected. Show qualifying capacity on results. Validate these proposed bands against the launch sample before freezing identifiers.

## Matching and results

- OR within countries, genres, or size bands; AND across groups. All conditions must match the same Occurrence.
- Filter editions before displaying them; one result per matching edition, ordered by start date, name, then stable ID. A later matching edition must not be hidden by an earlier nonmatch.
- Include `ticketAvailability` in discovery summaries. Sold-out editions remain in results with a “Sold out” badge in list/map previews and details; availability adds no filter or sorting rule.
- Map and list share the result set; the map contains its coordinate-bearing subset. Report total/coordinate-bearing/unlocated counts independently of the current viewport. Desktop displays both views; narrow layouts provide easy switching.
- Preserve selections on zero results and offer constraint removal/Clear all. Request errors are retryable errors, not empty results; retries retain state and stale responses cannot replace newer results.

## Summary loading and details

The backend returns all public discovery summaries for the active scope, including date/status, names, links, classification/filter values, location precision, and coordinates when available. It must not truncate to a first page or map viewport. Proposed interpretation of “BE returns all”: the browser applies filters to this complete summary set; the server uses the same matching rules to render the linked list for a directly opened filter URL. Include historical discoverable summaries so explicit past-date filters work; exclude drafts, withdrawn records, and cancelled/postponed editions under the rules above. This proposal does not change publication gates or require loading full event details in advance.

Load full descriptions and attendance details when a visitor selects a marker or list result. Preserve the result set on detail errors and offer retry; a late response must not replace a newer selection. Every result has a stable Occurrence link, and direct Event/Occurrence URLs render complete public pages on the server. Internal audit/evidence payloads are never public summaries. UI windowing or map clustering may reduce rendering work but must not silently remove results. Any future server-side pagination or viewport loading requires a revised product decision.

## URL contract

Persist applied state and restore it on reload, back/forward, and view changes:

| Keys | Values |
| --- | --- |
| `q`, `place` | Name and locality/region text |
| `from`, `to` | Both ISO dates, or neither for upcoming/ongoing |
| `country`, `genre` | Repeated country codes / taxonomy slugs |
| `durationMin`, `durationMax` | Optional positive integer bounds |
| `size` | Repeated `lt-1000`, `1000-4999`, `5000-19999`, `20000-49999`, `gte-50000` |
| `view` | `list` or `map`; preferred narrow-layout view, while desktop displays both |

Omit defaults, deduplicate/order multi-values, and serialize resolved dates rather than relative shortcuts. Validate values and ordered date/duration bounds in UI and server. Invalid filters show a recoverable error, never silently broaden the query; unrelated keys are not predicates. `bbox` is unsupported and never constrains discovery. Applied filter/search combinations use `noindex,follow` and stay out of the sitemap; view-only variants canonicalize to the clean scope root. The [website structure spec](005-website-structure-and-urls.md) defines page paths and scope domains.

## Validation

Check date overlap, leap/year boundaries, one-day and separate-weekend duration, tentative/status rules, genre ancestry, size-band boundaries and unknowns, same-edition matching, unlocated/approximate map points, URL restoration, Apply/Cancel/reset, empty/error states, and keyboard/mobile flows. Verify desktop shows both views, narrow layouts switch without losing state, map movement does not fetch/filter results, complete summaries are returned, and detail clicks handle failures and stale responses. Check browser/server matching parity and direct crawlable detail routes. Use fixed dates and saved fixtures. Confirm price never affects filtering or sorting.

Before implementation, align domain validation with positive capacity and add typed storage for original-currency price summaries. Duration and size bands are derived values, not taxonomy terms. Validate source coverage using the information brief's sample; sparse data must remain visibly unknown.

Check edition-wide versus partial sell-out, unknown availability, failed-check preservation, supported reopening, and new-edition isolation; sold-out status must not remove an otherwise eligible result.
