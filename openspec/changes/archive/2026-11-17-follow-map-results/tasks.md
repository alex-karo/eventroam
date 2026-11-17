# Tasks

## 1. Area rules and visit state

- [x] 1.1 Add the pure area filter from the design. Use existing summary builders
  to test ordinary bounds, date-line and shifted bounds, full-world coverage,
  missing coordinates, and stable row order. Verify the focused model tests pass.
- [x] 1.2 Extend the visit snapshot with only the follow setting. Extend existing
  snapshot tests to verify a missing flag defaults to on, invalid flag values
  are rejected, and the flag survives a save and read. Keep storage failure checks.

## 2. Map and list behavior

- [x] 2.1 Keep the camera callback and add the separate area callback. Report an
  area after user gestures, zoom controls, cluster expansion, initial fit, camera
  restoration, and enabling follow. Test that resize and selection pans keep the
  area, enabling follow reads current bounds, and an unavailable map reports null.
  Include an initial report without located rows in the focused Mapbox stub tests.
- [x] 2.2 Add `Follow map`, on by default. Keep normal results for map data and
  card eligibility, then apply the area to list rows and pending filter counts.
  Add focused Discovery tests that check the map retains off-area inventory, a
  card survives its row leaving the area, and toggle changes keep other filters.
- [x] 2.3 Add the active-area counts, empty-area hint, and unlocated-event
  explanation. Keep the heading switch as the recovery control and retain the
  normal filter-empty state. Add component checks for switch recovery without
  clearing other filters, no-token and map-error fallback, and accessibility.
- [x] 2.4 Save and restore the follow setting. Derive a fresh area from the restored
  camera. Keep the runtime area during mobile expansion and card layout changes.
  Extend existing navigation and real-map journeys to verify this behavior, zoom
  and cluster area changes, and selected cards outside the area. Adjust existing
  journeys to disable follow before they select an off-area or unlocated row.
- [x] 2.5 Update the Discovery paragraph in `docs/project-structure.md` to explain
  the map's full filter results and the optional area list. Verify
  `pnpm run docs:check` passes.

## 3. Integration checks

- [x] 3.1 Use the built-in Browser on desktop and a narrow mobile layout. Check
  the proposal's acceptance criteria with a working map, including keyboard use,
  an empty area, unlocated results with follow off, and mobile list expansion.
  Verify the heading switch fits at 320px and report any unavailable map checks.
- [x] 3.2 Run the focused discovery and visit tests, `pnpm run type-check`,
  `pnpm run lint`, `pnpm run deps:check`, and
  `pnpm run openspec:validate -- follow-map-results`. Verify all checks pass and
  report any limit before implementation handoff.
