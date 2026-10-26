# Tasks

## 1. Public detail facts

- [x] 1.1 Extend `catalog/read/contracts.ts` and `public-catalog.ts` with category amount, currency, and terms plus Edition coordinates, precision, and time zone. Remove redundant `hasCoordinates` consumers. Verify `public-catalog.test.ts` covers major-unit amounts, zero without currency, null points, and the explicit public-field allowlist without exposing category URLs or private evidence.
- [x] 1.2 Move the existing `localToday` and `durationDays` helpers into browser-safe catalog logic for discovery and shared views. Add the ended-Edition predicate using those rules. Reuse current date/duration tests and add boundary cases for ongoing versus past Editions and time-zone/UTC fallback.

## 2. Shared facts, icons, and ticket views

- [x] 2.1 Update shared date and location formatting for readable ranges, inclusive duration, and English country names. Add consistent decorative fact icons. Verify representative same-month, cross-year, one-day, and incomplete-location output in focused component checks.
- [x] 2.2 Add a shared external-link group with inline outline icons, visible labels, title, aria-label, and compact targets. Keep labels within the viewport and container edges. Preserve official-link inheritance. Verify duplicate URLs collapse, distinct destinations remain distinguishable, and keyboard focus has a clear indicator.
- [x] 2.3 Update shared ticket views to show category amounts, terms, separate statuses, and missing-data messages. Keep base prices independent and omit category purchase buttons. Verify zero, missing price, base-only data, absent tickets, and a sold-out promotional category do not invent a current minimum price.
- [x] 2.4 Apply historical price wording and suppress stale Available badges. Include the Edition year in historical ticket-link names. Verify a past Edition retains Sold out, closed-sale labels, and cancellation or postponement notices where applicable.

## 3. Edition page and compact Event history

- [x] 3.1 Rebuild `EditionDetailsPage` with the specified fact header, general Event description, ticket section, location section, and Edition navigation. Use one column at every screen width, with a readable content width, the current font and colors, and smaller headings and gaps. Verify the same section order and omission of absent optional facts at desktop and narrow widths.
- [x] 3.2 Add the single-point Edition map using current Mapbox settings. Add precision-aware initial zoom, attribution, zoom controls, Show on map, and an external place link. Verify exact and approximate points, absent coordinates, scroll-wheel behavior, and load-failure fallback without depending on live Mapbox in unit tests.
- [x] 3.3 Reduce `EventDetailsPage` to its name, optional summary, catalog navigation, and public Edition list. Remove its active-selection call, the unused `selectActive` helper, and obsolete assertions while retaining publication tests. Use one shared history component on both pages for ordering, labels, links, and list styles, with an optional current Edition ID. Keep section headings in their pages. Verify the shared output on both route forms, repeated years, current-Edition indication, newest-first order, discovery-token links, and existing alias/publication tests.

## 4. One discovery selection card

- [x] 4.1 Replace the duplicate selected popup and full panel with one compact selected card. Preserve marker hover previews without selection, hide them while the selected card is open, and allow them after close. Keep title and View links, retry, stale-response protection, close, and focus return. Omit descriptions, categories, and availability. Verify hover transitions, quick selection changes, and failure/retry with the existing selection-hook tests and focused card checks.
- [x] 4.2 Add the desktop side card with fixed width and the narrow-screen bottom card with fixed compact and expanded heights, capped by the viewport as defined in design.md. Use internal scrolling for overflow and keep expand, collapse, and close controls. Do not add drag-to-resize or content-driven sizing. Verify the initial mobile facts, expanded price/link content, keyboard controls, switching selections, enlarged text, content overflow, and usability in list view without a working map. Use actual rendered card bounds for map visibility.
- [x] 4.3 Keep selected points visible outside the measured card bounds without changing zoom. Handle a point within a cluster without forcing cluster expansion. Verify selected-marker visibility, no movement for unlocated results, and no camera reset on close.

## 5. Return to discovery

- [x] 5.1 Add a tab-local visit snapshot and context-token flow as defined in design.md. Store the full snapshot only in session storage and only its token in history state. Use one restore routine for both return paths. Preserve framework history fields and ordinary link fallbacks. Verify direct entry does not pick an unrelated search and URL normalization consumes transient context without changing applied filters or canonical identity.
- [x] 5.2 Wire detail links, Back to results, Event navigation, and history links to the same visit context. Restore map position before initial fit, list scroll after layout, and selected details through a fresh read. Verify explicit return, browser Back, remount, multiple search entries, unavailable storage, and a selection no longer eligible for discovery.

## 6. Integration and handoff

- [x] 6.1 Extend the default no-map end-to-end coverage for discovery to Edition to Event/history and return. Verify filters, view, scroll, selection, historical tickets, direct entry, and missing-map fallbacks work together. On macOS, obtain approved execution outside the command sandbox before a shell runner launches full Chrome.
- [x] 6.2 Add a simple opt-in real-map mode in `scripts/run-e2e.mjs` and `playwright.config.ts` that forwards a supplied local Mapbox token. Keep the default no-map mode. Run a small real-map check for card overlap, clustered selection, preserved zoom, and camera return where setup is straightforward. If live-map access or rendering needs substantial extra work, use partial checks or omit this run and record exactly what was not verified. Do not add a map mock system for this purpose. Complete the guide update in the final documentation task.
- [x] 6.3 Use the built-in Browser for local desktop and mobile UI checks, including 320-pixel width. Verify labeled link buttons, keyboard focus, card expansion, long terms, and repeated links. Check map scrolling and point visibility when a real map is available. Record the observed results and any map coverage limits in the implementation handoff.
- [x] 6.4 After all behavior is implemented, sync the complete requirement blocks into `catalog/publication` and `website/discovery`, and add `website/festival-details` to the main specs. Update `docs/project-structure.md` for page, map, and discovery-state ownership, and `docs/development.md` for the map test modes. Verify the updated specs and guides describe the completed behavior and state ownership without retaining the old active-Edition block.
- [x] 6.5 Run `npm run type-check`, `npm run lint`, `npm run deps:check`, `npm test`, `npm run format:check`, `npm run docs:check`, and `npm run openspec:validate`. Verify the main specs match the completed behavior and that the pending public-site-launch change still has both public route forms available.

## 7. Card clarity after visual review

- [x] 7.1 Keep the linked title and 44-pixel icon controls in a compact fixed header. Style View as the primary action. Preserve fixed card sizes and existing navigation context. Extend the 320-pixel and enlarged-text E2E checks to verify the title and controls stay visible during scrolling and return restores expansion.
- [x] 7.2 Shorten shared date ranges, keep duration together, and show tentative dates as a badge. Put card status near dates, emphasize the base amount, retain all price conditions, and give genres more weight than general types. Distinguish additional official-site links with an information icon and unify map coverage labels. Update focused formatting, link, and presentation checks plus affected E2E assertions.
- [x] 7.3 Strengthen the selected map marker and leave at least 24 pixels between its outer edge and the card. Include marker size in safe-area math. Verify overlap clearance, unchanged zoom, no camera reset on close, and camera return with focused and real-map checks.
- [x] 7.4 Sync the revised owning main specs. Run project checks and default and real-map E2E. Inspect desktop and 320-pixel layouts in the built-in Browser and save screenshots that show the new hierarchy and fixed header. Verify full discovery context still restores.

## 8. Compact links and fixed card action

- [x] 8.1 Show visible labels in shared external-link buttons with a 32-pixel minimum height and 16-pixel icons. Remove custom tooltip rows. Move the renamed View action to a fixed bottom-right footer without changing card sizes or return state. Update focused presentation tests and E2E checks for visible names, keyboard focus, narrow layout, footer position, and navigation restoration.
- [x] 8.2 Sync the affected main specs and run type, lint, format, and OpenSpec checks. Inspect desktop and 320-pixel cards and Edition links in the built-in Browser. Save screenshots and verify the footer stays visible when content scrolls.

## 9. Short fact labels

- [x] 9.1 Put Tentative dates after the shared date range and use Not mapped with a Map location unavailable title for missing points and map counts. Sync the affected main specs and update existing text assertions. Run focused component and affected E2E checks, type, lint, format, and OpenSpec checks. Inspect desktop and 320-pixel card and Edition layouts in the built-in Browser and save screenshots.

## 10. Review regressions

- [x] 10.1 Fix COR1: retain list scroll while mobile Map view hides its scroll box. Restore it when List is visible. Add regression checks for browser Back and Back to results.
- [x] 10.2 Fix REL1: restore the saved camera without moving it to the restored selection. Keep marker placement, new-selection reveal, zoom, and card clearance. Add real-map checks after the visitor pans the selected point off screen.
- [x] 10.3 Add TST4: return through both paths after the detail response changes, and assert the new card content. Sync the restoration scenarios and design. Run relevant E2E and project checks, then inspect both fixes in the built-in Browser.

## 11. Repeat review fixes

- [x] 11.1 Fix COR1 from the repeat review: ignore the active view button and save each new visit token. Add a regression for repeated view clicks and Back/Forward with selection and expansion retained.
- [x] 11.2 Fix REL3: update or remove the selected marker when catalog coordinates change without moving the camera. Add real-map regressions for changed and removed coordinates after selection.
- [x] 11.3 Apply SIM1 from the repeat review: combine card styles into one base block and one mobile block. Remove unused selectors and overridden declarations. Retain computed styles and fixed sizes. Check desktop and 320-pixel cards in the built-in Browser.
- [x] 11.4 Sync the affected discovery scenarios and design, correct the guide's obsolete tooltip text, and run project checks plus the affected default and real-map E2E suites.
