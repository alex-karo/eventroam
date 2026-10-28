# Proposal

## Why

The source reader drops embedded maps and structured coordinates from festival pages. Research should receive map links, context, and supported My Maps point markers in the same `readPage` response, without another tool call.

## What Changes

- Preserve map links and nearby text from anchors, iframes, and known lazy attributes in Markdown.
- Read Google My Maps links with `mid` inside `readPage`. Support `embed`, `viewer`, and `edit` links. Read each unique map once per call, within the shared budget.
- Include map titles, descriptions, layer names, and point marker names, descriptions, and coordinates. Keep dates and years in source text.
- Skip lines and polygons with a short notice. Do not select a venue or derive a point.
- Preserve ordinary Google Maps links without fetching their data or resolving short links.
- Include `Event.location.geo` and `Place.geo` with their object context.
- Keep page content when a map cannot be read. Report the map limitation and use the existing Markdown limit.

## Capabilities

### Modified Capabilities

- `catalog/source-access`:
  - **Before**: The reader caches full page Markdown and returns a bounded model projection. The implementation drops iframe maps and JSON-LD geo fields. It does not read linked maps as part of a page call.
  - **After**: One page call includes map context and supported My Maps point data, with bounded internal HTTP reads and explicit limits.

## Impact

Changes are confined to ingestion source access, adjacent tests, and its documentation. The model tool keeps its current input and output schema. No new service or dependency is planned. No catalog schema, database writes, Location tools, venue selection rules, browser rendering, general script parser, or polygon processing is included.
