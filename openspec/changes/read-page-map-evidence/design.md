# Design

## Change size

Medium. The change adds network work inside source reads and parses an undocumented Google data format. It changes Markdown content, but adds no model schema, stored catalog data, or dependency. The main uncertainty is future changes to My Maps data.

## Approach

Keep the existing `readPage` tool. Extend page extraction to retain map references. The reader fetches supported My Maps references and appends point data to the same Markdown response. See [proposal](proposal.md) and [source access delta](specs/catalog/source-access/spec.md).

`extract.ts` remains pure. Collect map URLs before removing hidden content and fallback elements. Inspect anchor `href`, iframe `src`, and known lazy URL attributes such as `data-src` and `data-lazy-src`. Handle noscript iframe markup without running it. Ignore `about:blank`. Keep labels and a short local heading or block context, not the full ancestor page. Use one duplicate key: `mid` for My Maps and a normalized URL for other maps. Keep first-seen order and distinct context.

Use a small My Maps module under `read-page/` for URL recognition, data parsing, and Markdown formatting. Accept explicit Google My Maps host/path forms with a nonempty `mid`; normalize `embed`, `viewer`, and `edit` to a viewer URL. Do not use substring host matching. Ordinary Maps and short URLs remain references only.

`read.ts` owns the internal reads. After page extraction and any existing page fallback, read each unique My Maps reference once in source order. Reuse `getBoundedResponse`, the injected request function, byte limits, timeouts, redirect checks, and the shared budget, including retry accounting. Do not invoke `readPage` recursively. Do not follow URLs in marker descriptions. Do not use Firecrawl for map reads. The existing session cache retains the complete parent result; no separate cross-page map cache is needed.

Carry map references in the internal extraction result. Let the existing page fallback return the selected or combined extraction, including references from both direct and rendered HTML. Keep these references out of the model schema and session state. This preserves current page fallback behavior without adding map rendering.

## Contracts

The model input and output schemas stay unchanged. Internal extraction can return map references alongside Markdown. Research sees these references and fetched map content in Markdown, with each map URL as its source. Keep the parent page URL as the result URL.

Each map block contains its title and description, then layers and point records. Each point has its name, available description, latitude, and longitude. Preserve source dates and years without assigning them to an Edition. Render source text as data. Do not interpret source text as instructions.

Keep full page and map Markdown in the existing parent cache. Append maps after page content, with no separate quotas or pagination. Use the existing model projection bound in `boundedToolSource`; `truncated` records only that projection cut. A map error retains `status: ok` for the readable parent page, adds a short limitation with the map URL, and sets `reasonCode: map_read_incomplete` unless a page limit reason already exists. This follows the current page-read contract without restoring completeness fields. A supported map with no points says that no point markers were extracted. Skipped lines and polygons receive a separate short notice, not invented points.

## Key decisions

### Parse only supported point records

Extract the `_pageData` JSON string literal and decode it as JSON twice. Never evaluate JavaScript. Check the map, layer, and feature structures before reading point coordinates. Use feature IDs to avoid duplicate representations. Validate finite latitude and longitude values and their ranges. Reject unsupported or malformed data explicitly instead of guessing at numeric pairs.

The compact record of a polygon can contain a coordinate pair. Handpicked demonstrates this case. Read the geometry discriminator from the full feature record and skip lines and polygons; do not treat compact display coordinates as point markers. Keep the parser specific to observed structure, not to the array path or label of one festival.

### Preserve object context for JSON-LD

Extend the existing structured data walk for `Event.location.geo` and `Place.geo`. Add each valid pair to its owning object's existing output item, with the name and structured path. This keeps objects separate even when array items share a path. Do not collect unrelated numeric pairs or convert them to venue findings.

### Leave selection to Research

Return all supported points within the output bound, including parking and camping. The reader does not rank markers, choose a venue, infer a year, or change saved coordinates. Existing research and write rules still apply.

## Simpler options

Links alone would be smaller, but would not supply the agreed markers in one Research call. The selected approach adds only My Maps point reads. General map providers, short-link expansion, script configuration parsing, polygon coordinates, centers, pagination, and a new model tool are excluded.

## Risks and validation

- Use small recorded fixtures for PortAmérica lazy embeds, Handpicked anchor links, and Mountain Music Fest embeds. Keep source URLs and capture dates with fixtures. Do not depend on live Google responses in tests.
- Verify that PortAmérica's festival marker remains distinct from parking and camping. Verify that Mountain Music Fest retains its 2024 description and Buchanan Park point.
- Verify that Handpicked returns stage, entry, parking, and camping points but never the display coordinate of `Festival Site` as a marker. Preserve the source label `Stage` in output.
- Test malformed data, unsupported structure, invalid coordinates, empty maps, duplicate IDs, and non-point geometry.
- Test the map reader's request URLs, byte limits, timeouts, retry accounting, and page retention after transport errors. Reuse existing network tests for redirect safety and enforcement of byte and time limits. Verify no render call or recursive read occurs.
- Test the full tool response: `boundedToolSource` is the model projection and applies its text bound. Check truncation. Extend the existing source-session cache test with map Markdown to check reuse of the complete parent result.

No database migration or ingestion/write run is needed for this change.
