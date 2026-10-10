# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. `Discovery` currently owns applied and pending `Filters`, builds category-only chips, and calculates applied results with `filterSummaries`. `FilterPanel` receives the complete summary set but has no preview count; countries are sorted ISO codes and place is a free-text field. The current model validates date and duration bounds and shares matching rules with server rendering. Existing URL helpers preserve the narrow-screen view preference.

This design is needed to coordinate presentation, validation, pending state, and keyboard behavior across those modules. No live visual audit has been completed in this checkout; the approach is grounded in source, existing tests, and the discovery contract.

## Goals / Non-Goals

**Goals:** Derive chips and previews from existing filter state, reuse matching and validation, and make location controls discoverable without a second location model.

**Non-Goals:** No new persistence, remote search, geocoding, facet-count engine, matching semantics, toolbar relocation, or modal-sheet architecture. Dates and duration retain their existing controls and defaults. Product scope remains the first three selected research recommendations.

## Decisions

### 1. Derive value chips from applied filters

Add small pure presentation helpers near the discovery model rather than storing a parallel chip state. Use stable identities based on field and canonical value, never the translated label. Each country, genre, and size band produces a chip; name and place each produce one, while date and duration bounds form one chip per range. Format dates with years using a fixed English locale and UTC date interpretation. Format duration as exact, bounded, minimum-only, or maximum-only text. Size labels retain the existing numeric bands.

Use English country names from `Intl.DisplayNames` with a defensive code fallback for unavailable display data. Reuse the formatter in picker and chips. Do not persist display names or replace codes in URLs. This avoids migrations and supports valid direct links selecting countries absent from the catalog. Verify supported runtime country names during implementation.

Removal constructs the next applied filter object and uses the existing apply/URL path. Removing one value does not reset its whole group. If removal occurs with a picker open, close it and discard pending edits, consistent with the current apply behavior. For keyboard removal, focus the next surviving chip, then the previous chip if necessary, or Clear all when none remain; do not return focus to an unrelated picker opener. Keep chip text readable and wrapping at 320px, including in mobile map mode, without allowing long queries to overflow the viewport.

Alternative: editable category-summary chips are more compact, but would retain the ambiguity and coarse removal behavior the user chose to address.

### 2. Validate and count pending state without committing

While a picker is open, normalize pending filters with the existing validation boundary and pass valid values to `filterSummaries`. Count all editions, not just those with map points. Use the same catalog and `initialNow` time reference as applied results, with stable memoization inputs if caching the derived calculation. No new fetch is needed. Recompute when pending values or the catalog change. The preview includes the applied name query; unsubmitted name-search text stays separate.

Pass the count or validation message into `FilterPanel`. Valid state renders "Show N editions" ("Show 1 edition" for one). Zero is valid and remains actionable. Invalid state shows a nonnumeric "Apply filters" action that cannot commit, with visible feedback linked to the relevant input or input group. Keep the existing throwing `normalizeFilters` API and catch its error for preview feedback; no structured-error refactor or new validation framework is needed. A polite status region announces count changes without moving focus or making the whole form live.

The panel also checks native date/number input validity during editing and before applying. A partial date or malformed number can expose an empty value while `validity.badInput` is true; do not treat it as an intentionally empty filter. Suppress the preview and prevent Apply until corrected or fully cleared. Keep this editing-state check local to the panel, with a short corrective message, while semantic rules remain in the existing model validator.

Applying uses the normalized pending state through the existing commit path. Cancel/Escape and group-switch behavior retain the current contract. For invalid direct URLs, preview edits never clear the existing error; only a valid explicit apply or reset recovers it.

Alternative: immediately updating list and map would change established pending/apply semantics and distract users while they combine criteria. Per-option counts are a separate feature and are not needed for a total preview.

### 3. Keep location identity and matching unchanged

Country options are the union of catalog country codes and selected valid codes. Display and sort English names, using code as a stable tie-breaker. Add a labeled "Search countries" input matching English name or ISO code case-insensitively. This search is local picker UI state, resets when the picker opens, and never enters the URL or result predicate. Keep selected options visible separately from matching unselected options, with no duplicates. An empty country-search result must not be presented as an empty festival result set.

Build city/region suggestions from nonempty `locality` and `administrativeArea` values in the complete summary set, including history. Restrict that source by pending countries when provided, but do not prune it by other filters. This keeps the location vocabulary stable while preview counts explain the effect of the complete query. Match typed text case-insensitively, deduplicate place/country pairs, sort deterministically, and show at most ten matching suggestions after the user types nonblank text. Annotate each with the English country name.

Normalize suggestion text using the existing place whitespace rules and omit values longer than the existing 200-character query limit. Share only the small normalization helper or limit needed to avoid duplicating that rule; do not truncate suggestions or change the catalog's 250-character limit. Selecting a suggestion copies only its normalized locality or region text into `pending.place`; the country annotation is context, not a hidden country selection. Identical place text can therefore match several countries, as existing substring semantics permit. Retain free-text entry and do not clear it when countries change. Helper text explains that users can type a city or region and optionally narrow by country.

Use an accessible editable combobox with listbox suggestions: arrow keys navigate, Enter selects without applying, and Escape first dismisses the suggestion list, then a subsequent Escape can dismiss the filter picker. Coordinate that event handling with the existing window Escape listener. Retain text focus on selection. A custom suggestion list allows country context and consistent keyboard behavior that an unqualified native datalist may not provide; no UI library is required.

## Risks / Trade-offs

- More chips increase vertical space, especially over the mobile map -> wrap within the available width, handle long labels, and inspect many selections at 320px and a typical phone width.
- Preview calculations run during editing -> reuse the local matcher, cache stable derived option lists, and check interaction responsiveness with a representative larger summary set before adding debounce or workers.
- Partial dates are temporarily invalid during normal entry -> provide short corrective feedback without labeling them as zero results or changing applied state.
- Country names can vary with runtime locale data -> request English explicitly, centralize formatting, and verify server/browser rendering consistency.
- Catalog suggestions are incomplete and repeated place names can be ambiguous -> retain free text, display country context, and preserve explicit country selection rather than silently narrowing results.
- Combobox Escape/Enter events can accidentally dismiss or submit the picker -> isolate suggestion events and cover this behavior in keyboard journeys.

## Migration Plan

Implement as a backward-compatible UI change. Existing URLs, public summaries, and stored catalog records remain valid; no data migration or dependency addition is planned. Extend focused unit tests and existing desktop/mobile journeys, then inspect the app through the built-in Browser. Full Chrome test-runner launches on macOS require approved execution outside the command sandbox.

After implementation and verification, synchronize this delta into the owning discovery spec and update relevant progress documentation. Rollback restores the previous UI without modifying stored data or shared URLs.
