# Proposal

## Why

The list currently keeps all filter results when the user moves or zooms the map.
The user wants the list to follow the map by default, with a short switch to turn
this behavior off. For example, a user who zooms into Portugal should see the
matching festivals in that map area.

## What Changes

- Add a `Follow map` switch, on by default, to the results heading.
- Apply the map area to the list after map movement ends. Keep the other filters.
- Explain area results and provide a way to return to all filter results.
- Preserve the search area when the mobile list expands. Restore the switch with
  the existing discovery visit and derive its area from the restored map.

The user selected the default and the ability to disable it. The details below
complete that behavior and preserve the existing selection and map fallback.
This change adds no catalog fields or server search endpoint.

## Requirements

- `Follow map` is on for a new discovery visit. Users can turn it off and on.
- While the map is available, the list follows its geographic bounds after a pan
  or zoom ends. The list keeps the active filters and date order. Events in
  clusters remain eligible by their coordinates.
- With `Follow map` off, the list shows all filter results, including events
  without coordinates. An unavailable map also leaves all filter results usable.
- The map retains all located filter results, so users can move to another area
  even when the current list is empty.
- The heading and result status identify an active map area. An empty area
  explains how to use the same `Follow map` switch to see all filter results.
- Expanding the mobile list or opening a card does not change the search area.
  Map movement can remove a list row without closing its selected card.
- Returning to a saved discovery visit restores its follow setting, camera, and
  filters. The list uses the restored map area.

## Acceptance criteria

- A fresh visit has `Follow map` on. Moving or zooming to a smaller area updates
  the list and count after movement ends, without changing the other filters.
- A cluster's individual events appear when their coordinates are inside the
  search area. Events outside the area do not appear in the list.
- Turning the switch off restores all matching rows, including unlocated events.
  Turning it on applies the current map area.
- An empty area explains that users can move the map or turn `Follow map` off.
  The switch stays available and keeps the active filters. The map remains movable.
- A mobile list expansion and a card opening keep the previous search area and
  list membership. Moving a selected event outside the area keeps its card open.
- Back navigation restores the prior follow setting and camera. The area results
  match the restored map, including after layout changes. With no map token or a
  map load failure, the list and its normal filters still work.
- Events near both sides of the date line remain eligible in a map area that
  crosses it. Repeated world copies do not add duplicate list rows.

## Impact

Discovery users get an area-based list by default. The discovery UI, map adapter,
visit state, focused tests, and the discovery paragraph in the
[project structure guide](../../../../docs/project-structure.md) will change.
The current filter rules and public catalog payload stay in place.
