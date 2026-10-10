# Tasks

## 1. Readable applied selections

- [x] 1.1 Add shared English country and filter-value presentation helpers plus per-selection removal transformations; verify focused unit cases for multiple countries/genres/sizes, date years, one-sided duration, and preservation of unrelated values.
- [x] 1.2 Replace category chips in discovery with value chips and accessible removal names, preserve URL/view behavior, and restore focus after removal; extend desktop/mobile journeys to verify removing Spain retains Portugal and place, removing the last chip focuses Clear all, and reload/history restore readable values.
- [x] 1.3 Adjust chip wrapping within the existing summary layout; verify long query text and many selections at 320px and a typical phone width in list and map modes using the built-in Browser.
- [x] 1.4 Once verified, sync the two applied-selection requirements into the owning discovery spec and record the implemented behavior in build progress; run `npm run openspec:validate` and `npm run docs:check`.

## 2. Pending-result preview

- [x] 2.1 Derive preview counts through shared normalization and matching using the applied-results catalog/time reference; add focused tests for total versus mapped counts, date overlap/history, zero results, incomplete dates, and reversed duration bounds.
- [x] 2.2 Integrate Show N editions actions and associated invalid-input feedback using the existing validator plus local native input-validity checks, with polite count announcements; extend browser journeys for partially typed dates and malformed duration input, and verify pending edits do not change chips/results/URL, Cancel/Escape restore focus, invalid input cannot apply, and applying produces the previewed total. Keep the existing validation API.
- [x] 2.3 Verify preview uses the applied name query rather than unsubmitted search text, and catalog refresh recomputes the count; exercise both transitions with controlled test data and confirm invalid direct URLs remain errors until explicit valid apply/reset.
- [x] 2.4 Once verified, sync preview and invalid-pending-input requirements into the owning discovery spec and update build progress; run `npm run openspec:validate` and `npm run docs:check`.

## 3. Location selection

- [x] 3.1 Display country names and add local country search, retaining selected countries outside the query/catalog; test case-insensitive name/code matching and verify URLs still store ISO codes in desktop/mobile journeys.
- [x] 3.2 Build catalog-backed locality/region suggestions with country context, deterministic deduplication, pending-country filtering, and omission of values exceeding the existing normalized query limit; test the 200/201-character boundary, whitespace normalization, historical catalog values, repeated names across countries, missing fields, and preserving free-text queries when countries change.
- [x] 3.3 Implement the City or region combobox with keyboard navigation and isolated Enter/Escape handling; verify choosing a suggestion changes only pending place, Escape dismisses suggestions before the picker, free text still applies, and no suggestion interaction submits filters accidentally.
- [x] 3.4 Once verified, sync country-choice and city/region requirements into the owning discovery spec and update build progress; run `npm run openspec:validate` and `npm run docs:check`.

## 4. Integrated verification

- [x] 4.1 Run `npm run type-check`, `npm run lint`, `npm run format:check`, `npm test`, and the desktop/mobile discovery e2e suite; obtain approved execution outside the command sandbox before full Chrome launches on macOS and record outcomes.
- [x] 4.2 Use the built-in Browser to verify the complete journey: select a date range and Portugal/Spain, inspect a preview, apply, remove Spain, restore with Back, and select a city suggestion; confirm keyboard focus, no horizontal overflow at 320px, preserved map/list state, and usable filter interactions with a representative larger catalog.
- [x] 4.3 Verify all delta scenarios are covered by tests or recorded browser checks and the main discovery spec matches implemented behavior; run `npm run openspec:validate` and `npm run docs:check` before declaring implementation complete.

## 5. Visible month shortcuts

- [x] 5.1 Replace date shortcuts with six labeled month buttons and selection feedback; verify calendar bounds, year transitions, pending/apply behavior and removal of the old controls in desktop/mobile journeys, sync the main spec and run validation.
